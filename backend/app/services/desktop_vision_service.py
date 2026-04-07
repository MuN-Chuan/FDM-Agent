from __future__ import annotations

import ast
import json
import re
from typing import Any

from pydantic import ValidationError

from app.models.desktop_vision import (
    DesktopVisionAction,
    DesktopVisionPlanRequest,
    DesktopVisionPlanResponse,
    DesktopVisionVerification,
)
from app.services.desktop_vision_prompt_builder import DesktopVisionPromptBuilder
from app.services.providers import provider_registry


class DesktopVisionService:
    def __init__(self) -> None:
        self.provider_id = "openrouter"
        self.model = "bytedance/ui-tars-1.5-7b"
        self.prompt_builder = DesktopVisionPromptBuilder()

    async def plan(self, request: DesktopVisionPlanRequest) -> DesktopVisionPlanResponse:
        provider = provider_registry.get_provider(self.provider_id)
        if provider is None:
            raise ValueError(f"Provider {self.provider_id} not found")

        prompt = self.prompt_builder.build(request)
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{request.screen.image_base64}"},
                    },
                ],
            }
        ]

        raw_text = await self._collect_text(provider.chat_completion(
            messages=messages,
            model=self.model,
            temperature=0.1,
            max_tokens=1200,
            stream=True,
        ))
        parsed = self._parse_response(raw_text)
        response = self._normalize_response(parsed, request.allowed_actions)
        return response

    async def _collect_text(self, stream: Any) -> str:
        chunks: list[str] = []
        async for chunk in stream:
            if isinstance(chunk, str) and chunk.startswith("data: "):
                payload = chunk[6:].strip()
                if not payload:
                    continue
                try:
                    data = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                if data.get("type") == "text" and data.get("content"):
                    chunks.append(data["content"])
                elif data.get("type") == "error":
                    raise ValueError(data.get("message") or "desktop vision provider error")
        return "".join(chunks).strip()

    def _load_json_object(self, raw_text: str) -> dict[str, Any]:
        try:
            parsed = json.loads(raw_text)
        except json.JSONDecodeError:
            repaired = self._repair_json_text(raw_text)
            try:
                parsed = json.loads(repaired)
            except json.JSONDecodeError:
                python_like = repaired
                python_like = re.sub(r"\btrue\b", "True", python_like, flags=re.IGNORECASE)
                python_like = re.sub(r"\bfalse\b", "False", python_like, flags=re.IGNORECASE)
                python_like = re.sub(r"\bnull\b", "None", python_like, flags=re.IGNORECASE)
                try:
                    parsed = ast.literal_eval(python_like)
                except (SyntaxError, ValueError) as exc:
                    raise ValueError(str(exc)) from exc

        if not isinstance(parsed, dict):
            raise ValueError("desktop vision model returned a non-object JSON payload")
        return parsed

    def _repair_json_text(self, raw_text: str) -> str:
        repaired = raw_text.strip()
        repaired = re.sub(r"^```(?:json)?\s*", "", repaired, flags=re.IGNORECASE)
        repaired = re.sub(r"\s*```$", "", repaired)
        repaired = repaired.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
        repaired = re.sub(r",(\s*[}\]])", r"\1", repaired)
        return repaired

    def _parse_response(self, raw_text: str) -> dict[str, Any]:
        if not raw_text:
            raise ValueError("desktop vision model returned empty response")

        try:
            return self._load_json_object(raw_text)
        except ValueError as exc:
            start = raw_text.find("{")
            end = raw_text.rfind("}")
            if start == -1 or end == -1 or end <= start:
                raise exc
            return self._load_json_object(raw_text[start:end + 1])

    def _require_object(self, value: Any, field_name: str) -> dict[str, Any]:
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise ValueError(f"invalid desktop vision planner payload: '{field_name}' must be a JSON object")
        return value

    def _coerce_action_payload(self, action_payload: dict[str, Any]) -> dict[str, Any]:
        normalized = dict(action_payload)
        x_value = normalized.get("x")
        y_value = normalized.get("y")

        if isinstance(x_value, str):
            pair_match = re.match(r"^\s*(-?\d+)\s*[,，]\s*(-?\d+)\s*$", x_value)
            if pair_match:
                normalized["x"] = int(pair_match.group(1))
                if y_value in (None, ""):
                    normalized["y"] = int(pair_match.group(2))
            else:
                integer_match = re.match(r"^\s*(-?\d+)\s*$", x_value)
                if integer_match:
                    normalized["x"] = int(integer_match.group(1))

        if isinstance(y_value, str):
            integer_match = re.match(r"^\s*(-?\d+)\s*$", y_value)
            if integer_match:
                normalized["y"] = int(integer_match.group(1))

        if isinstance(normalized.get("delta"), str):
            integer_match = re.match(r"^\s*(-?\d+)\s*$", normalized["delta"])
            if integer_match:
                normalized["delta"] = int(integer_match.group(1))

        if isinstance(normalized.get("duration_ms"), str):
            integer_match = re.match(r"^\s*(\d+)\s*$", normalized["duration_ms"])
            if integer_match:
                normalized["duration_ms"] = int(integer_match.group(1))

        if isinstance(normalized.get("confidence"), str):
            try:
                normalized["confidence"] = float(normalized["confidence"].strip())
            except ValueError:
                pass

        return normalized

    def _normalize_response(
        self,
        parsed: dict[str, Any],
        allowed_actions: list[str],
    ) -> DesktopVisionPlanResponse:
        status = parsed.get("status")
        message = parsed.get("message")

        if status == "continue":
            action_payload = self._coerce_action_payload(self._require_object(parsed.get("action"), "action"))
            if action_payload.get("type") not in allowed_actions:
                raise ValueError(f"action '{action_payload.get('type')}' is not allowed")
            action_payload.setdefault("reason", "planner_action")
            action_payload.setdefault("confidence", 0.5)

            try:
                action = DesktopVisionAction.model_validate(action_payload)
                verification = DesktopVisionVerification.model_validate(
                    self._require_object(parsed.get("verification"), "verification")
                )
            except ValidationError as exc:
                raise ValueError(f"invalid desktop vision planner payload: {exc}") from exc
            return DesktopVisionPlanResponse(
                status="continue",
                message=message,
                action=action,
                verification=verification,
            )

        if status in {"done", "failed"}:
            return DesktopVisionPlanResponse(status=status, message=message)

        raise ValueError(f"unsupported desktop vision status: {status}")
