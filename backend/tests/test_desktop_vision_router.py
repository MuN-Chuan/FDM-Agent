from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.services.desktop_vision_service import DesktopVisionService


client = TestClient(app)


def test_desktop_vision_plan_requires_auth():
    response = client.post(
        "/api/agent/desktop-vision/plan",
        json={
            "session_id": "dv_test_1",
            "task": "home_printer",
            "step": 1,
            "screen": {
                "image_base64": "ZmFrZQ==",
                "width": 1280,
                "height": 720,
                "window_title": "Bambu Studio",
            },
            "allowed_actions": ["click", "double_click", "wait"],
        },
    )
    assert response.status_code == 401


def test_desktop_vision_plan_validates_payload_after_auth_layer():
    response = client.post("/api/agent/desktop-vision/plan", json={})
    assert response.status_code == 401


def test_desktop_vision_plan_accepts_agent_bearer_token(monkeypatch):
    token = "desktop-vision-test-token"
    monkeypatch.setattr(settings, "DESKTOP_VISION_AGENT_TOKEN", token)

    async def fake_plan(self, request):
        del self, request
        return {
            "status": "done",
            "message": "planner accepted agent token",
        }

    monkeypatch.setattr(DesktopVisionService, "plan", fake_plan)

    response = client.post(
        "/api/agent/desktop-vision/plan",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "session_id": "dv_test_1",
            "task": "home_printer",
            "step": 1,
            "screen": {
                "image_base64": "ZmFrZQ==",
                "width": 1280,
                "height": 720,
                "window_title": "Bambu Studio",
            },
            "allowed_actions": ["click", "double_click", "wait"],
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "done"


def test_desktop_vision_plan_returns_422_for_service_value_error(monkeypatch):
    token = "desktop-vision-test-token"
    monkeypatch.setattr(settings, "DESKTOP_VISION_AGENT_TOKEN", token)

    async def fake_plan(self, request):
        del self, request
        raise ValueError("invalid desktop vision planner payload")

    monkeypatch.setattr(DesktopVisionService, "plan", fake_plan)

    response = client.post(
        "/api/agent/desktop-vision/plan",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "session_id": "dv_test_1",
            "task": "home_printer",
            "step": 1,
            "screen": {
                "image_base64": "ZmFrZQ==",
                "width": 1280,
                "height": 720,
                "window_title": "Bambu Studio",
            },
            "allowed_actions": ["click", "double_click", "wait"],
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "invalid desktop vision planner payload"
