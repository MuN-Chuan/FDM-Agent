import asyncio
import json

import pytest

from app.models.desktop_vision import DesktopVisionPlanRequest, DesktopVisionScreen
from app.services.desktop_vision_service import DesktopVisionService


class FakeProvider:
    def __init__(self, payload: str):
        self.payload = payload

    async def chat_completion(self, **kwargs):
        del kwargs
        yield f"data: {json.dumps({'type': 'text', 'content': self.payload}, ensure_ascii=False)}\n\n"
        yield 'data: {"type":"done","modifications":[],"usage":null}\n\n'


def build_request() -> DesktopVisionPlanRequest:
    return DesktopVisionPlanRequest(
        session_id="dv_test_1",
        task="home_printer",
        step=1,
        screen=DesktopVisionScreen(
            image_base64="ZmFrZQ==",
            width=1280,
            height=720,
            window_title="Bambu Studio",
        ),
        allowed_actions=["click", "double_click", "wait"],
    )


def test_prompt_builder_contains_task_and_actions():
    service = DesktopVisionService()
    prompt = service.prompt_builder.build(build_request())
    assert "home_printer" in prompt
    assert "click, double_click, wait" in prompt
    assert "窗口尺寸: 1280x720" in prompt


def test_plan_parses_continue_response(monkeypatch):
    service = DesktopVisionService()
    payload = (
        '{"status":"continue","action":{"type":"click","x":100,"y":200,'
        '"reason":"点击回中按钮","confidence":0.91},'
        '"verification":{"mode":"screen_change","expectation":"界面出现状态变化"}}'
    )

    from app.services import desktop_vision_service as module
    monkeypatch.setattr(module.provider_registry, "get_provider", lambda provider_id: FakeProvider(payload))

    result = asyncio.run(service.plan(build_request()))
    assert result.status == "continue"
    assert result.action is not None
    assert result.action.type == "click"
    assert result.action.x == 100
    assert result.verification is not None
    assert result.verification.mode == "screen_change"


def test_plan_rejects_action_outside_allowed_list(monkeypatch):
    service = DesktopVisionService()
    payload = (
        '{"status":"continue","action":{"type":"scroll","x":100,"y":200,"delta":-1,'
        '"reason":"滚动面板","confidence":0.9},'
        '"verification":{"mode":"screen_change","expectation":"面板滚动"}}'
    )

    from app.services import desktop_vision_service as module
    monkeypatch.setattr(module.provider_registry, "get_provider", lambda provider_id: FakeProvider(payload))

    with pytest.raises(ValueError, match="not allowed"):
        asyncio.run(service.plan(build_request()))


def test_plan_backfills_missing_reason_and_confidence(monkeypatch):
    service = DesktopVisionService()
    payload = (
        '{"status":"continue","action":{"type":"click","x":362,"y":107},'
        '"verification":{"mode":"screen_change","expectation":"界面发生变化"}}'
    )

    from app.services import desktop_vision_service as module
    monkeypatch.setattr(module.provider_registry, "get_provider", lambda provider_id: FakeProvider(payload))

    result = asyncio.run(service.plan(build_request()))
    assert result.status == "continue"
    assert result.action is not None
    assert result.action.reason == "planner_action"
    assert result.action.confidence == 0.5


def test_plan_coerces_combined_coordinate_string(monkeypatch):
    service = DesktopVisionService()
    payload = (
        '{"status":"continue","action":{"type":"click","x":"551,470"},'
        '"verification":{"mode":"screen_change","expectation":"界面发生变化"}}'
    )

    from app.services import desktop_vision_service as module
    monkeypatch.setattr(module.provider_registry, "get_provider", lambda provider_id: FakeProvider(payload))

    result = asyncio.run(service.plan(build_request()))
    assert result.status == "continue"
    assert result.action is not None
    assert result.action.x == 551
    assert result.action.y == 470


def test_plan_rejects_non_object_action_payload(monkeypatch):
    service = DesktopVisionService()
    payload = (
        '{"status":"continue","action":"click",'
        '"verification":{"mode":"screen_change","expectation":"界面发生变化"}}'
    )

    from app.services import desktop_vision_service as module
    monkeypatch.setattr(module.provider_registry, "get_provider", lambda provider_id: FakeProvider(payload))

    with pytest.raises(ValueError, match="'action' must be a JSON object"):
        asyncio.run(service.plan(build_request()))


def test_plan_rejects_non_object_top_level_payload(monkeypatch):
    service = DesktopVisionService()
    payload = '["continue"]'

    from app.services import desktop_vision_service as module
    monkeypatch.setattr(module.provider_registry, "get_provider", lambda provider_id: FakeProvider(payload))

    with pytest.raises(ValueError, match="non-object JSON payload"):
        asyncio.run(service.plan(build_request()))


def test_plan_parses_single_quotes_and_trailing_comma(monkeypatch):
    service = DesktopVisionService()
    payload = (
        "{'status':'continue','action':{'type':'click','x':'551,470',},"
        "'verification':{'mode':'screen_change','expectation':'界面发生变化',},}"
    )

    from app.services import desktop_vision_service as module
    monkeypatch.setattr(module.provider_registry, "get_provider", lambda provider_id: FakeProvider(payload))

    result = asyncio.run(service.plan(build_request()))
    assert result.status == "continue"
    assert result.action is not None
    assert result.action.x == 551
    assert result.action.y == 470
