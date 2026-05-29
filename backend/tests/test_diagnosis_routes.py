from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.models.diagnosis import DiagnosisResponse, Modification
from app.services.diagnosis_service import diagnosis_service


client = TestClient(app)


def _payload() -> dict:
    return {
        "detections": [{"label": "stringing", "confidence": 0.91}],
        "description": "surface has many thin strings",
        "safety_constraints": "do not change nozzle temperature",
        "preset_data": {
            "printer": {"name": "P1S"},
            "filament": [{"name": "PLA Basic"}],
            "process": {"layer_height": 0.2},
        },
    }


def test_diagnose_route_returns_structured_payload(monkeypatch) -> None:
    calls: dict[str, object] = {}

    async def fake_analyze(*, detections, description, safety_constraints, preset_data, api_settings, request_modifications):
        calls["detections"] = detections
        calls["description"] = description
        calls["safety_constraints"] = safety_constraints
        calls["preset_data"] = preset_data
        calls["api_settings"] = api_settings
        calls["request_modifications"] = request_modifications
        return DiagnosisResponse(
            reasoning_markdown="### ok",
            modifications=[
                Modification(
                    name="retraction_distance",
                    category="process",
                    old="0.8",
                    new="1.0",
                    range="0.6-1.4",
                    reason="reduce stringing",
                    risk="low",
                )
            ],
        )

    monkeypatch.setattr(diagnosis_service, "analyze", fake_analyze)

    response = client.post("/api/diagnose", json=_payload())

    assert response.status_code == 200
    assert response.json()["reasoning_markdown"] == "### ok"
    assert response.json()["modifications"][0]["name"] == "retraction_distance"
    assert calls["description"] == "surface has many thin strings"
    assert calls["safety_constraints"] == "do not change nozzle temperature"
    assert calls["api_settings"] is None
    assert calls["request_modifications"] is False


def test_diagnose_stream_route_returns_sse(monkeypatch) -> None:
    async def fake_stream(*, detections, description, safety_constraints, preset_data, api_settings, request_modifications):
        yield 'data: {"type":"text","content":"partial"}\n\n'
        yield 'data: {"type":"done","reasoning_markdown":"### stream ok","modifications":[]}\n\n'

    monkeypatch.setattr(diagnosis_service, "analyze_stream", fake_stream)

    response = client.post("/api/diagnose/stream", json=_payload())

    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    assert '"type":"text"' in response.text
    assert '"type":"done"' in response.text
