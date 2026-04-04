# backend/tests/test_vision_service.py
import pytest
from app.services.vision_service import VisionService

@pytest.fixture
def vision_service():
    return VisionService()

def test_build_vision_prompt(vision_service):
    prompt = vision_service.build_prompt("home_printer", ["click", "type"])
    assert "home_printer" in prompt
    assert "click" in prompt
    assert "type" in prompt

def test_parse_ai_response_valid(vision_service):
    response = '{"type": "action", "action": "click", "x": 100, "y": 200, "description": "test"}'
    result = vision_service.parse_ai_response(response)
    assert result["type"] == "action"
    assert result["action"] == "click"
    assert result["x"] == 100

def test_parse_ai_response_invalid(vision_service):
    result = vision_service.parse_ai_response("not json")
    assert result is None