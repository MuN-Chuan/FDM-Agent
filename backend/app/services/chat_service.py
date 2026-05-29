import json
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.models.chat import ChatMessage
from app.models.diagnosis import ApiSettings
from app.services.preset_inheritance_service import preset_inheritance_service
from app.services.providers import provider_registry


SYSTEM_PROMPT = """
你是一名专业的 FDM 3D 打印助手。

你的职责：
1. 分析打印缺陷图片和用户描述。
2. 优先输出缺陷判断、成因分析、排查步骤和处理建议。
3. 只有当用户明确要求参数优化时，才输出具体切片参数修改建议。

输出要求：
- 使用中文回答。
- 默认不要输出 `json_modifications`。
- 只有当用户明确要求参数修改时，才在回答末尾追加 `json_modifications` 代码块。
- 对于枚举型参数，`json_modifications[].new` 必须使用切片软件内部英文原始值。
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
                    default_model=api_settings.model_name or "",
                )
                supports_vision = False
                return provider, api_settings.model_name or "", None, None, supports_vision

            if api_settings.provider_id:
                provider = provider_registry.get_provider(api_settings.provider_id)
                if provider:
                    supports_vision = provider.supports_vision
                    return (
                        provider,
                        api_settings.model_name or provider.default_model,
                        None,
                        None,
                        supports_vision,
                    )

        provider = provider_registry.get_provider("zhipu")
        return provider, settings.LLM_MODEL_NAME, None, None, supports_vision

    def _filter_preset(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(data, dict):
            return data

        filtered = {}
        for key, value in data.items():
            key_lower = key.lower()
            if "gcode" in key_lower or "thumbnail" in key_lower:
                continue
            if isinstance(value, dict):
                filtered[key] = self._filter_preset(value)
            else:
                filtered[key] = value
        return filtered

    def _expand_preset_context(self, preset_data: Dict[str, Any]) -> Dict[str, Any]:
        if preset_data.get("printer"):
            preset_data["printer"] = preset_inheritance_service.get_full_preset(
                preset_data["printer"],
                "printer",
            )
        if preset_data.get("process"):
            preset_data["process"] = preset_inheritance_service.get_full_preset(
                preset_data["process"],
                "process",
            )
        if isinstance(preset_data.get("filament"), list):
            preset_data["filament"] = [
                preset_inheritance_service.get_full_preset(item, "filament")
                for item in preset_data["filament"]
            ]
        return preset_data

    def _append_optimization_context(
        self,
        system_prompt: str,
        preset_data: Optional[Dict[str, Any]],
    ) -> str:
        if not preset_data:
            return system_prompt

        system_prompt += "\n\n【已加载切片参数上下文】\n"

        printer = preset_data.get("printer", {})
        process = preset_data.get("process", {})
        filaments = preset_data.get("filament", [])

        if printer:
            system_prompt += (
                "**Printer**\n```json\n"
                + json.dumps(self._filter_preset(printer), ensure_ascii=False, indent=2)
                + "\n```\n\n"
            )
        if process:
            system_prompt += (
                "**Process**\n```json\n"
                + json.dumps(self._filter_preset(process), ensure_ascii=False, indent=2)
                + "\n```\n\n"
            )
        for index, filament in enumerate(filaments, start=1):
            system_prompt += (
                f"**Filament {index}**\n```json\n"
                + json.dumps(self._filter_preset(filament), ensure_ascii=False, indent=2)
                + "\n```\n\n"
            )

        return system_prompt

    def _build_messages(
        self,
        messages: List[ChatMessage],
        image_base64: Optional[str],
        preset_data: Optional[Dict[str, Any]],
        request_modifications: bool,
        supports_vision: bool = True,
    ) -> list:
        optimization_context = None
        if request_modifications and preset_data:
            optimization_context = self._expand_preset_context(dict(preset_data))

        full_system_prompt = SYSTEM_PROMPT
        if request_modifications:
            full_system_prompt += (
                "\n当前任务包含明确的参数优化意图。"
                "请在分析结论后给出可执行的 `json_modifications`。"
            )
            full_system_prompt = self._append_optimization_context(
                full_system_prompt,
                optimization_context,
            )
        else:
            full_system_prompt += (
                "\n当前任务不是参数优化任务。"
                "请专注于缺陷识别与结果分析，不要默认输出调参建议。"
            )

        api_messages = [{"role": "system", "content": full_system_prompt}]
        history_started = False

        for index, message in enumerate(messages):
            if not history_started and message.role != "user":
                continue

            history_started = True
            is_last = index == len(messages) - 1

            if message.role == "assistant":
                api_messages.append({"role": "assistant", "content": message.content})
                continue

            content_text = message.content

            if request_modifications and message.slicer_result:
                settings = message.slicer_result.get("full_settings", {})
                if settings:
                    content_text = (
                        "【已附加 3MF 切片参数上下文】\n```json\n"
                        + json.dumps(self._filter_preset(settings), ensure_ascii=False, indent=2)
                        + "\n```\n\n"
                        + content_text
                    )

            if is_last and image_base64 and supports_vision:
                content: Any = [
                    {"type": "text", "text": content_text},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
                    },
                ]
            else:
                content = content_text

            if is_last and request_modifications:
                suffix = "\n\n请输出明确的 `json_modifications`，并确保字段完整。"
                if isinstance(content, str):
                    content += suffix
                else:
                    content[0]["text"] += suffix

            api_messages.append({"role": "user", "content": content})

        return api_messages

    async def chat_stream(
        self,
        messages: List[ChatMessage],
        image_base64: Optional[str],
        preset_data: Optional[Dict[str, Any]],
        api_settings: Optional[ApiSettings],
        request_modifications: bool = False,
    ):
        provider, model_name, api_key, base_url, supports_vision = self._get_provider_and_model(
            api_settings
        )
        api_messages = self._build_messages(
            messages,
            image_base64,
            preset_data,
            request_modifications,
            supports_vision,
        )

        try:
            async for chunk in provider.chat_completion(
                messages=api_messages,
                model=model_name,
                api_key=api_key,
                base_url=base_url,
                temperature=0.7,
                max_tokens=8192,
                stream=True,
            ):
                yield chunk
        except Exception as error:
            yield f"data: {json.dumps({'type': 'error', 'message': str(error)}, ensure_ascii=False)}\n\n"


chat_service = ChatService()
