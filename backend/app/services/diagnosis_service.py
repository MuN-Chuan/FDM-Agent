from __future__ import annotations

import json

from openai import AuthenticationError, OpenAIError, RateLimitError

from app.core.config import settings
from app.models.diagnosis import ApiSettings, Detection, DiagnosisResponse, MatchedCase, PresetData
from app.services.optimization import build_optimization_prompt, case_matcher, parse_structured_response
from app.services.preset_inheritance_service import preset_inheritance_service
from app.services.providers import provider_registry


class DiagnosisService:
    def _filter_preset_dict(self, data: dict) -> dict:
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

    def _expand_preset_data(self, preset_data: PresetData) -> PresetData:
        if preset_data.printer:
            preset_data.printer = preset_inheritance_service.get_full_preset(preset_data.printer, "printer")
        if preset_data.process:
            preset_data.process = preset_inheritance_service.get_full_preset(preset_data.process, "process")
        preset_data.filament = [
            preset_inheritance_service.get_full_preset(filament, "filament")
            for filament in preset_data.filament
        ]
        return preset_data

    def _resolve_provider(self, api_settings: ApiSettings | None):
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

    def _build_prompt(
        self,
        detections: list[Detection],
        description: str | None,
        preset_data: PresetData,
        request_modifications: bool,
    ) -> tuple[str, list[dict[str, object]]]:
        matched_cases = case_matcher.match_cases(
            detections=detections,
            description=description,
            preset_data=preset_data,
        )
        prompt = build_optimization_prompt(
            description=description,
            detections=[item.model_dump() for item in detections],
            matched_cases=matched_cases,
            printer=self._filter_preset_dict(preset_data.printer),
            process=self._filter_preset_dict(preset_data.process),
            filament=[self._filter_preset_dict(item) for item in preset_data.filament],
            request_modifications=request_modifications,
        )
        return prompt, matched_cases

    def _default_error_response(self, title: str, detail: str) -> DiagnosisResponse:
        return DiagnosisResponse(
            reasoning_markdown=f"### {title}\n{detail}",
            modifications=[],
            detected_defects=[],
            matched_cases=[],
            parameter_recommendations=[],
        )

    async def analyze_stream(
        self,
        detections: list[Detection],
        description: str | None,
        safety_constraints: str | None,
        preset_data: PresetData,
        api_settings: ApiSettings | None = None,
        request_modifications: bool = False,
    ):
        if request_modifications:
            preset_data = self._expand_preset_data(preset_data)

        user_prompt, matched_cases = self._build_prompt(
            detections,
            description,
            preset_data,
            request_modifications,
        )
        if safety_constraints:
            user_prompt += f"\nSafety constraints:\n{safety_constraints}\n"

        provider, model_name, api_key, base_url = self._resolve_provider(api_settings)
        messages = [
            {
                "role": "system",
                "content": "Return valid JSON only. Do not wrap the response in markdown fences.",
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
                    except json.JSONDecodeError:
                        yield chunk
                        continue
                    if data.get("type") == "text":
                        full_text += data.get("content", "")
                    yield chunk
                else:
                    yield chunk

            clean_text = full_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            if not clean_text:
                yield f"data: {json.dumps({'type': 'error', 'message': 'AI returned an empty response'}, ensure_ascii=False)}\n\n"
                return

            parsed = parse_structured_response(json.loads(clean_text))
            yield (
                "data: "
                + json.dumps(
                    {
                        "type": "done",
                        "reasoning_markdown": parsed.reasoning_markdown,
                        "modifications": [item.model_dump() for item in parsed.modifications],
                        "matched_cases": [item.model_dump() for item in parsed.matched_cases] or matched_cases,
                        "parameter_recommendations": [item.model_dump() for item in parsed.parameter_recommendations],
                    },
                    ensure_ascii=False,
                )
                + "\n\n"
            )
        except Exception as error:
            yield f"data: {json.dumps({'type': 'error', 'message': str(error)}, ensure_ascii=False)}\n\n"

    async def analyze(
        self,
        detections: list[Detection],
        description: str | None,
        safety_constraints: str | None,
        preset_data: PresetData,
        api_settings: ApiSettings | None = None,
        request_modifications: bool = False,
    ) -> DiagnosisResponse:
        if request_modifications:
            preset_data = self._expand_preset_data(preset_data)

        user_prompt, matched_cases = self._build_prompt(
            detections,
            description,
            preset_data,
            request_modifications,
        )
        if safety_constraints:
            user_prompt += f"\nSafety constraints:\n{safety_constraints}\n"

        provider, model_name, api_key, base_url = self._resolve_provider(api_settings)
        messages = [
            {"role": "system", "content": "Return valid JSON only. Do not wrap the response in markdown fences."},
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

            clean_text = full_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            if not clean_text:
                return self._default_error_response("AI returned no diagnosis", "The provider returned an empty body.")

            result = parse_structured_response(json.loads(clean_text))
            if not result.matched_cases:
                result.matched_cases = [MatchedCase(**case) for case in matched_cases]
            return result
        except json.JSONDecodeError:
            return self._default_error_response("AI response parsing failed", full_text)
        except (RateLimitError, AuthenticationError) as error:
            title = "AI service authorization problem"
            return self._default_error_response(title, str(error))
        except OpenAIError as error:
            return self._default_error_response("AI service invocation failed", str(error))
        except Exception as error:
            return self._default_error_response("Internal diagnosis error", str(error))


diagnosis_service = DiagnosisService()
