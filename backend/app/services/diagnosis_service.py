import json
from typing import List, Optional

from openai import AuthenticationError, OpenAIError, RateLimitError

from app.core.config import settings
from app.models.diagnosis import (
    ApiSettings,
    Detection,
    DiagnosisResponse,
    Modification,
    PresetData,
)
from app.services.preset_inheritance_service import preset_inheritance_service
from app.services.providers import provider_registry


class DiagnosisService:
    def __init__(self) -> None:
        pass

    def _filter_preset_dict(self, data: dict) -> dict:
        """Keep slicing values while dropping noisy script/thumbnail fields."""
        filtered = {}
        for key, value in data.items():
            key_lower = key.lower()
            if "gcode" in key_lower or "thumbnail" in key_lower:
                continue
            if isinstance(value, dict):
                filtered[key] = self._filter_preset_dict(value)
            elif isinstance(value, list):
                if len(value) < 100:
                    filtered[key] = value
            else:
                filtered[key] = value
        return filtered

    def _build_prompt(
        self,
        detections: List[Detection],
        description: Optional[str],
        preset_data: PresetData,
        request_modifications: bool,
    ) -> str:
        prompt = (
            "你是一名专业的 FDM 3D 打印缺陷分析助手。"
            "当前任务优先级是：先识别和分析打印缺陷，再决定是否需要参数优化。\n\n"
        )

        if detections:
            prompt += "【视觉识别结果】\n"
            for detection in detections:
                prompt += f"- 缺陷类型: {detection.label} (置信度 {detection.confidence:.2f})\n"
            prompt += "\n"
        else:
            prompt += "【视觉识别结果】当前未提供识别结果，请仅基于用户描述进行分析。\n\n"

        if description:
            prompt += f"【用户补充描述】\n{description}\n\n"

        if request_modifications:
            prompt += "【优化模式】用户明确需要切片参数优化建议，请结合以下切片参数给出可执行修改。\n\n"

            printer_data = self._filter_preset_dict(preset_data.printer)
            process_data = self._filter_preset_dict(preset_data.process)

            prompt += f"--- 机器参数 (Printer) ---\n{json.dumps(printer_data, ensure_ascii=False)}\n\n"
            prompt += f"--- 工艺参数 (Process) ---\n{json.dumps(process_data, ensure_ascii=False)}\n\n"

            for index, filament in enumerate(preset_data.filament, start=1):
                filament_data = self._filter_preset_dict(filament)
                prompt += (
                    f"--- 材料参数 (Filament {index}) ---\n"
                    f"{json.dumps(filament_data, ensure_ascii=False)}\n\n"
                )
        else:
            prompt += (
                "【分析模式】当前只需要输出缺陷成因、影响判断、排查顺序和处理建议。"
                "不要默认进入预设/3MF 调参流程，`modifications` 必须返回空数组。\n\n"
            )

        prompt += (
            "【输出要求】\n"
            "必须严格输出合法 JSON，对象包含两个字段：\n"
            '1. "reasoning_markdown": Markdown 字符串，说明缺陷判断、原因分析、建议措施。\n'
            '2. "modifications": 数组。只有在 request_modifications=true 时才填写参数修改建议；否则返回 []。\n'
            '每条 modifications 包含: "name", "category", "old", "new", "range", "reason", "risk"。\n'
        )

        return prompt

    def _expand_preset_data(self, preset_data: PresetData) -> PresetData:
        if preset_data.printer:
            preset_data.printer = preset_inheritance_service.get_full_preset(
                preset_data.printer,
                "printer",
            )
        if preset_data.process:
            preset_data.process = preset_inheritance_service.get_full_preset(
                preset_data.process,
                "process",
            )

        preset_data.filament = [
            preset_inheritance_service.get_full_preset(filament, "filament")
            for filament in preset_data.filament
        ]
        return preset_data

    def _resolve_provider(self, api_settings: Optional[ApiSettings]):
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
                return provider, api_settings.model_name or "", None, None

            if api_settings.provider_id:
                provider = provider_registry.get_provider(api_settings.provider_id)
                if provider:
                    return provider, api_settings.model_name or provider.default_model, None, None

        provider = provider_registry.get_provider("zhipu")
        return provider, settings.LLM_MODEL_NAME, None, None

    async def analyze_stream(
        self,
        detections: List[Detection],
        description: Optional[str],
        safety_constraints: Optional[str],
        preset_data: PresetData,
        api_settings: Optional[ApiSettings] = None,
        request_modifications: bool = False,
    ):
        """Stream diagnosis results as SSE chunks."""
        if request_modifications:
            preset_data = self._expand_preset_data(preset_data)

        user_prompt = self._build_prompt(
            detections,
            description,
            preset_data,
            request_modifications,
        )
        if safety_constraints:
            user_prompt += (
                f"\n【重要安全约束】\n{safety_constraints}\n"
                "绝对不能输出违反这些约束的参数建议。\n"
            )

        provider, model_name, api_key, base_url = self._resolve_provider(api_settings)

        messages = [
            {
                "role": "system",
                "content": "你是 3D 打印分析助手，必须只输出原生 JSON，不要使用 Markdown 代码块。",
            },
            {"role": "user", "content": user_prompt},
        ]

        try:
            full_text = ""
            async for chunk in provider.chat_completion(
                messages=messages,
                model=model_name,
                api_key=api_key,
                base_url=base_url,
                temperature=0.3,
                max_tokens=8192,
                stream=True,
            ):
                if chunk.startswith("data: "):
                    data_str = chunk[6:]
                    try:
                        data = json.loads(data_str)
                        if data.get("type") == "text":
                            full_text += data.get("content", "")
                        yield chunk
                    except json.JSONDecodeError:
                        yield chunk
                else:
                    yield chunk

            clean_text = full_text.strip()
            if not clean_text:
                yield (
                    f"data: {json.dumps({'type': 'error', 'message': 'AI 未生成有效诊断结果'}, ensure_ascii=False)}\n\n"
                )
                return

            if clean_text.startswith("```json"):
                clean_text = clean_text.replace("```json", "", 1)
            if clean_text.endswith("```"):
                clean_text = clean_text[::-1].replace("```", "", 1)[::-1]
            if clean_text.startswith("```"):
                clean_text = clean_text.replace("```", "", 1)

            result_json = json.loads(clean_text.strip())
            yield (
                "data: "
                + json.dumps(
                    {
                        "type": "done",
                        "reasoning_markdown": result_json.get("reasoning_markdown", "生成分析失败"),
                        "modifications": result_json.get("modifications", []),
                    },
                    ensure_ascii=False,
                )
                + "\n\n"
            )
        except Exception as error:
            yield (
                f"data: {json.dumps({'type': 'error', 'message': str(error)}, ensure_ascii=False)}\n\n"
            )

    async def analyze(
        self,
        detections: List[Detection],
        description: Optional[str],
        safety_constraints: Optional[str],
        preset_data: PresetData,
        api_settings: Optional[ApiSettings] = None,
        request_modifications: bool = False,
    ) -> DiagnosisResponse:
        if request_modifications:
            preset_data = self._expand_preset_data(preset_data)

        system_prompt = "你是 3D 打印分析助手，必须只输出原生 JSON，不要使用 Markdown 代码块。"
        user_prompt = self._build_prompt(
            detections,
            description,
            preset_data,
            request_modifications,
        )

        if safety_constraints:
            user_prompt += (
                f"\n【重要安全约束】\n{safety_constraints}\n"
                "绝对不能输出违反这些约束的参数建议。\n"
            )

        provider, model_name, api_key, base_url = self._resolve_provider(api_settings)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        try:
            full_text = ""
            async for chunk in provider.chat_completion(
                messages=messages,
                model=model_name,
                api_key=api_key,
                base_url=base_url,
                temperature=0.3,
                max_tokens=8192,
                stream=False,
            ):
                if not chunk.startswith("data: "):
                    continue
                data_str = chunk[6:]
                try:
                    data = json.loads(data_str)
                except json.JSONDecodeError:
                    continue
                if data.get("type") == "text":
                    full_text += data.get("content", "")

            result_text = full_text.strip()
            if not result_text:
                return DiagnosisResponse(
                    reasoning_markdown="### AI 返回内容为空\n模型未返回有效诊断信息。",
                    modifications=[],
                )

            clean_text = result_text
            if clean_text.startswith("```json"):
                clean_text = clean_text.replace("```json", "", 1)
            if clean_text.endswith("```"):
                clean_text = clean_text[::-1].replace("```", "", 1)[::-1]
            if clean_text.startswith("```"):
                clean_text = clean_text.replace("```", "", 1)

            result_json = json.loads(clean_text.strip())
            modifications = [Modification(**item) for item in result_json.get("modifications", [])]
            return DiagnosisResponse(
                reasoning_markdown=result_json.get("reasoning_markdown", "生成分析失败"),
                modifications=modifications,
            )
        except json.JSONDecodeError:
            return DiagnosisResponse(
                reasoning_markdown=(
                    "### AI 响应解析失败\n"
                    f"模型返回内容不是合法 JSON。\n\n```text\n{full_text}\n```"
                ),
                modifications=[],
            )
        except (RateLimitError, AuthenticationError) as error:
            error_type = (
                "额度不足或速率受限"
                if isinstance(error, RateLimitError)
                else "鉴权失败"
            )
            return DiagnosisResponse(
                reasoning_markdown=f"### AI 服务授权问题\n{error_type}\n\n{error}",
                modifications=[
                    Modification(
                        name="API_AUTH_ERROR",
                        category="system",
                        old="N/A",
                        new="N/A",
                        range="N/A",
                        reason="API 授权或配额异常",
                        risk="high",
                    )
                ],
            )
        except OpenAIError as error:
            return DiagnosisResponse(
                reasoning_markdown=f"### AI 服务调用异常\n{error}",
                modifications=[
                    Modification(
                        name="API_ERROR",
                        category="system",
                        old="N/A",
                        new="N/A",
                        range="N/A",
                        reason="模型接口调用失败",
                        risk="high",
                    )
                ],
            )
        except Exception as error:
            return DiagnosisResponse(
                reasoning_markdown=f"### 系统内部错误\n{error}",
                modifications=[
                    Modification(
                        name="INTERNAL_ERROR",
                        category="system",
                        old="N/A",
                        new="N/A",
                        range="N/A",
                        reason="诊断服务内部异常",
                        risk="high",
                    )
                ],
            )


diagnosis_service = DiagnosisService()
