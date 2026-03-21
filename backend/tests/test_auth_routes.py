from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.routers import auth as auth_router


client = TestClient(app)


def test_request_email_code_returns_debug_code(monkeypatch) -> None:
    class DummyUser:
        id = "user-1"
        email = "tester@example.com"

    monkeypatch.setattr(auth_router.auth_service, "get_user_by_email", lambda db, email: DummyUser())
    monkeypatch.setattr(auth_router.auth_service, "create_email_login_code", lambda db, email: "123456")
    monkeypatch.setattr(auth_router.auth_service, "send_email_login_code", lambda email, code: None)

    response = client.post("/api/auth/email-code/request", json={"email": "tester@example.com"})

    assert response.status_code == 200
    assert response.json()["message"] == "Verification code sent"
    assert response.json()["debug_code"] == "123456"


def test_request_email_code_for_register_allows_new_email(monkeypatch) -> None:
    monkeypatch.setattr(auth_router.auth_service, "get_user_by_email", lambda db, email: None)
    monkeypatch.setattr(
        auth_router.auth_service,
        "get_registration_policy",
        lambda: {"mode": "open", "invite_required": False, "registration_enabled": True},
    )
    monkeypatch.setattr(auth_router.auth_service, "create_email_login_code", lambda db, email: "654321")
    monkeypatch.setattr(auth_router.auth_service, "send_email_login_code", lambda email, code: None)

    response = client.post("/api/auth/email-code/request", json={"email": "new@example.com", "purpose": "register"})

    assert response.status_code == 200
    assert response.json()["debug_code"] == "654321"


def test_email_code_login_returns_user(monkeypatch) -> None:
    class DummyUser:
        id = "user-1"
        email = "tester@example.com"
        role = "user"
        points_balance = 1000
        is_active = True
        created_at = "2026-01-01T00:00:00Z"
        last_login_at = None

    monkeypatch.setattr(auth_router.auth_service, "login_with_email_code", lambda db, email, code: DummyUser())
    monkeypatch.setattr(auth_router.auth_service, "touch_login", lambda db, user: None)
    monkeypatch.setattr(auth_router.auth_service, "create_access_token", lambda user: "access-token")
    monkeypatch.setattr(auth_router.auth_service, "create_refresh_token", lambda db, user, user_agent, ip_address: "refresh-token")

    response = client.post("/api/auth/email-code/login", json={"email": "tester@example.com", "code": "123456"})

    assert response.status_code == 200
    assert response.json()["user"]["email"] == "tester@example.com"
    assert response.json()["user"]["points_balance"] == 1000


def test_email_code_register_returns_user(monkeypatch) -> None:
    class DummyUser:
        id = "user-2"
        email = "new@example.com"
        role = "user"
        points_balance = 1000
        is_active = True
        created_at = "2026-01-01T00:00:00Z"
        last_login_at = None

    monkeypatch.setattr(
        auth_router.auth_service,
        "register_with_email_code",
        lambda db, email, code, invite_code: DummyUser(),
    )
    monkeypatch.setattr(auth_router.auth_service, "touch_login", lambda db, user: None)
    monkeypatch.setattr(auth_router.auth_service, "create_access_token", lambda user: "access-token")
    monkeypatch.setattr(auth_router.auth_service, "create_refresh_token", lambda db, user, user_agent, ip_address: "refresh-token")

    response = client.post(
        "/api/auth/email-code/register",
        json={"email": "new@example.com", "code": "654321"},
    )

    assert response.status_code == 201
    assert response.json()["user"]["email"] == "new@example.com"
