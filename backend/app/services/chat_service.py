import json
import re
from typing import List, Optional, Dict, Any
from openai import AsyncOpenAI
from app.models.chat import ChatMessage
from app.models.diagnosis import ApiSettings
from app.core.config import settings
from app.services.preset_inheritance_service import preset_inheritance_service
from app.services.providers import provider_registry


SYSTEM_PROMPT = """你是一个专业的 FDM (熔融沉积成型) 3D 打印顾问助手。你的任务是：
1. 解答用户关于 3D 打印的各种问题（参数调优、缺陷排查、材料选择等）
2. 分析用户提供的图片（如有）
3. 参考用户上传的切片预设文件（如有）
4. 当用户明确请求时，提供具体的切片参数修改建议

回答要求：
- 使用清晰的 Markdown 格式
- 语言：中文，技术术语可附英文
- 特别注意：对于任何下拉选择框（枚举值）类型的参数，在 `json_modifications` 的 `new` 字段中，**必须严格使用全小写的内部英文实际值**（例如：必须输出 "rear" 而绝不能是 "Rear" 或 "背后"；必须输出 "aligned" 而绝不能是 "Aligned" 或 "对齐"）。绝对不能首字母大写或使用本地化翻译。
- 如果用户请求参数修改，需在回答末尾附加一个特殊 JSON 块，格式如下：
```json_modifications
[
  {"name": "seam_position", "category": "process", "old": "aligned", "new": "rear", "range": "nearest,aligned,rear,random", "reason": "将接缝藏在背后", "risk": "low"}
]
```
- 如果用户没有明确请求参数修改，不要输出 json_modifications 块
"""


class ChatService:
    def _get_provider_and_model(self, api_settings: Optional[ApiSettings]) -> tuple:
        supports_vision = True
        if api_settings:
            if api_settings.is_custom and api_settings.custom_api_key and api_settings.custom_base_url:
                from app.services.providers.custom_provider import CustomOpenAICompatibleProvider
                provider = CustomOpenAICompatibleProvider(
                    provider_id="custom",
                    name=api_settings.custom_provider_name or "Custom",
                    base_url=api_settings.custom_base_url,
                    api_key=api_settings.custom_api_key,
                    default_model=api_settings.model_name or ""
                )
                supports_vision = False
                return provider, api_settings.model_name or "", None, None, supports_vision

            if api_settings.provider_id:
                provider = provider_registry.get_provider(api_settings.provider_id)
                if provider:
                    supports_vision = provider.supports_vision
                    return provider, api_settings.model_name or provider.default_model, None, None, supports_vision

        provider = provider_registry.get_provider("zhipu")
        model_name = settings.LLM_MODEL_NAME
        return provider, model_name, None, None, supports_vision

    def _filter_preset(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Remove G-code and thumbnails from preset for context."""
        if not isinstance(data, dict):
            return data
        filtered = {}
        for k, v in data.items():
            k_lower = k.lower()
            if "gcode" in k_lower or "thumbnail" in k_lower:
                continue
            if isinstance(v, dict):
                filtered[k] = self._filter_preset(v)
            else:
                # No longer stripping lists by length, as 3MF settings might have important lists
                filtered[k] = v
        return filtered

    def _build_messages(
        self,
        messages: List[ChatMessage],
        image_base64: Optional[str],
        preset_data: Optional[Dict[str, Any]],
        request_modifications: bool,
        supports_vision: bool = True
    ) -> list:
        """Build the messages payload for the LLM API."""
        # NEW: Expand presets with base profiles if they are incomplete diffs
        if preset_data:
            if "printer" in preset_data and preset_data["printer"]:
                preset_data["printer"] = preset_inheritance_service.get_full_preset(preset_data["printer"], "printer")
            if "process" in preset_data and preset_data["process"]:
                preset_data["process"] = preset_inheritance_service.get_full_preset(preset_data["process"], "process")
            if "filament" in preset_data and isinstance(preset_data["filament"], list):
                new_filaments = []
                for fil in preset_data["filament"]:
                    new_filaments.append(preset_inheritance_service.get_full_preset(fil, "filament"))
                preset_data["filament"] = new_filaments

        full_system_prompt = SYSTEM_PROMPT

        # Inject preset context into system prompt if provided
        if preset_data:
            full_system_prompt += "\n\n【已加载用户预设文件上下文】\n"
            printer = preset_data.get("printer", {})
            process = preset_data.get("process", {})
            filaments = preset_data.get("filament", [])

            if printer:
                filtered_printer = self._filter_preset(printer)
                full_system_prompt += f"**机器 (Printer)**:\n```json\n{json.dumps(filtered_printer, ensure_ascii=False, indent=2)}\n```\n\n"
            if process:
                filtered_process = self._filter_preset(process)
                full_system_prompt += f"**工艺 (Process)**:\n```json\n{json.dumps(filtered_process, ensure_ascii=False, indent=2)}\n```\n\n"
            for i, fil in enumerate(filaments):
                filtered_fil = self._filter_preset(fil)
                full_system_prompt += f"**材料 {i+1} (Filament)**:\n```json\n{json.dumps(filtered_fil, ensure_ascii=False, indent=2)}\n```\n\n"

        api_messages = [{"role": "system", "content": full_system_prompt}]

        # Sanitize history: conversation MUST start with a 'user' message for many APIs (like Zhipu)
        # We skip any leading assistant messages (like the default welcome message)
        history_started = False
        
        # Build conversation history
        for i, msg in enumerate(messages):
            if not history_started and msg.role != "user":
                continue
            
            history_started = True
            is_last = (i == len(messages) - 1)

            if msg.role == "user":
                content_text = msg.content
                
                # If message has its own hidden 3MF attachment, inject it
                if msg.slicer_result:
                    # slicer_result is the ThreeMFParseResult dict
                    settings = msg.slicer_result.get("full_settings", {})
                    if settings:
                        filtered_3mf = self._filter_preset(settings)
                        content_text = f"【用户附带了 3MF 预设文件上下文】\n```json\n{json.dumps(filtered_3mf, ensure_ascii=False, indent=2)}\n```\n\n{content_text}"

                # If last message and there's an image, add it (Vision capabilities)
                # Only add image if the model supports vision
                if is_last and image_base64 and supports_vision:
                    content = [
                        {"type": "text", "text": content_text},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}}
                    ]
                else:
                    content = content_text

                # If user is explicitly requesting modifications
                if is_last and request_modifications:
                    suffix = "\n\n（请提供具体的 json_modifications 参数修改建议）"
                    if isinstance(content, str):
                        content += suffix
                    elif isinstance(content, list):
                        content[0]["text"] += suffix

                api_messages.append({"role": "user", "content": content})
            else:
                api_messages.append({"role": "assistant", "content": msg.content})

        return api_messages

    async def chat_stream(
        self,
        messages: List[ChatMessage],
        image_base64: Optional[str],
        preset_data: Optional[Dict[str, Any]],
        api_settings: Optional[ApiSettings],
        request_modifications: bool = False
    ):
        """Streaming chat that yields text chunks and optional structured modifications."""
        provider, model_name, api_key, base_url, supports_vision = self._get_provider_and_model(api_settings)
        api_messages = self._build_messages(messages, image_base64, preset_data, request_modifications, supports_vision)

        print(f"--- CHAT STREAM START ---")
        print(f"Provider: {provider.provider_id}, Model: {model_name}, Messages: {len(api_messages)}, Image: {bool(image_base64)}, Vision: {supports_vision}")

        try:
            async for chunk in provider.chat_completion(
                messages=api_messages,
                model=model_name,
                api_key=api_key,
                base_url=base_url,
                temperature=0.7,
                max_tokens=8192,
                stream=True
            ):
                yield chunk

        except Exception as e:
            print(f"[Chat] Stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"


chat_service = ChatService()
