import json
import re
from typing import List, Optional, Dict, Any
from openai import AsyncOpenAI
from app.models.chat import ChatMessage
from app.models.diagnosis import ApiSettings
from app.core.config import settings
from app.services.preset_inheritance_service import preset_inheritance_service


SYSTEM_PROMPT = """你是一个专业的 FDM (熔融沉积成型) 3D 打印顾问助手。你的任务是：
1. 解答用户关于 3D 打印的各种问题（参数调优、缺陷排查、材料选择等）
2. 分析用户提供的图片（如有）
3. 参考用户上传的切片预设文件（如有）
4. 当用户明确请求时，提供具体的切片参数修改建议

回答要求：
- 使用清晰的 Markdown 格式
- 语言：中文，技术术语可附英文
- 如果用户请求参数修改，需在回答末尾附加一个特殊 JSON 块，格式如下：
```json_modifications
[
  {"name": "retraction_length", "old": "0.8", "new": "1.2", "range": "0.4-2.0mm", "reason": "减少拉丝", "risk": "low"}
]
```
- 如果用户没有明确请求参数修改，不要输出 json_modifications 块
"""


class ChatService:
    def _get_client(self, api_settings: Optional[ApiSettings]) -> tuple:
        api_key = (api_settings.api_key if api_settings and api_settings.api_key.strip()
                   else settings.LLM_API_KEY)
        base_url = (api_settings.base_url if api_settings and api_settings.base_url.strip()
                    else settings.LLM_BASE_URL)
        model_name = (api_settings.model_name if api_settings and api_settings.model_name.strip()
                      else settings.LLM_MODEL_NAME)

        if base_url and not base_url.endswith('/'):
            base_url += '/'

        client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        return client, model_name

    def _filter_preset(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Remove G-code and thumbnails from preset for context."""
        filtered = {}
        for k, v in data.items():
            k_lower = k.lower()
            if "gcode" in k_lower or "thumbnail" in k_lower:
                continue
            if isinstance(v, dict):
                filtered[k] = self._filter_preset(v)
            elif isinstance(v, list):
                if len(v) < 100:
                    filtered[k] = v
            else:
                filtered[k] = v
        return filtered

    def _build_messages(
        self,
        messages: List[ChatMessage],
        image_base64: Optional[str],
        preset_data: Optional[Dict[str, Any]],
        request_modifications: bool
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
                content: Any = msg.content

                # If last message and there's an image, add it (Vision capabilities)
                if is_last and image_base64:
                    content = [
                        {"type": "text", "text": msg.content},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}}
                    ]

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
        client, model_name = self._get_client(api_settings)
        api_messages = self._build_messages(messages, image_base64, preset_data, request_modifications)

        print(f"--- CHAT STREAM START ---")
        print(f"Model: {model_name}, Messages: {len(api_messages)}, Image: {bool(image_base64)}")

        try:
            stream = await client.chat.completions.create(
                model=model_name,
                messages=api_messages,
                temperature=0.7,
                max_tokens=8192,
                stream=True,
                stream_options={"include_usage": True}
            )

            full_text = ""
            usage = None
            async for chunk in stream:
                # Robust usage extraction
                curr_usage = getattr(chunk, 'usage', None)
                if curr_usage:
                    prompt_details = getattr(curr_usage, 'prompt_tokens_details', None)
                    cached_tokens = getattr(prompt_details, 'cached_tokens', 0) if prompt_details else 0
                    
                    usage = {
                        "prompt_tokens": getattr(curr_usage, 'prompt_tokens', 0),
                        "completion_tokens": getattr(curr_usage, 'completion_tokens', 0),
                        "total_tokens": getattr(curr_usage, 'total_tokens', 0),
                        "cache_tokens": cached_tokens
                    }
                    print(f"[Chat] Captured usage: {usage}")

                if not chunk.choices:
                    continue

                # Stream reasoning content (DeepSeek R1 etc.)
                reasoning = getattr(chunk.choices[0].delta, 'reasoning_content', None)
                if reasoning:
                    yield f"data: {json.dumps({'type': 'thought', 'content': reasoning}, ensure_ascii=False)}\n\n"

                content = chunk.choices[0].delta.content
                if content:
                    full_text += content
                    yield f"data: {json.dumps({'type': 'text', 'content': content}, ensure_ascii=False)}\n\n"

            # After stream ends, extract modifications if present
            modifications = []
            mod_match = re.search(
                r'```json_modifications\s*([\s\S]*?)\s*```',
                full_text,
                re.DOTALL
            )
            if mod_match:
                try:
                    mod_json = mod_match.group(1).strip()
                    modifications = json.loads(mod_json)
                except (json.JSONDecodeError, ValueError) as e:
                    print(f"[Chat] Failed to parse json_modifications: {e}")

            yield f"data: {json.dumps({'type': 'done', 'modifications': modifications, 'usage': usage}, ensure_ascii=False)}\n\n"

        except Exception as e:
            print(f"[Chat] Stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"


chat_service = ChatService()
