# backend/tests/test_vision_router.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_analyze_endpoint_requires_auth():
    response = client.post("/api/agent/vision/analyze", json={
        "screenshot_base64": "test",
        "task": "home_printer"
    })
    assert response.status_code in [401, 403]


def test_analyze_endpoint_validation():
    response = client.post("/api/agent/vision/analyze", json={})
    assert response.status_code == 401
