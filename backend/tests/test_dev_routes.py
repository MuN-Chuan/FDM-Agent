from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.db.base import Base
from app.db.models import ChatFeedback, ChatSession, User
from app.db.session import SessionLocal, engine, get_db
from app.main import app


client = TestClient(app)
Base.metadata.create_all(bind=engine)


def test_dev_overview_and_feedback_routes() -> None:
    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = get_db

    user_id = str(uuid4())
    session_id = f"chat-{uuid4()}"
    feedback_id = str(uuid4())

    try:
        with SessionLocal() as db:
            user = User(
                id=user_id,
                email=f"dev-{uuid4()}@example.com",
                password_hash="hashed",
                role="developer",
            )
            session = ChatSession(
                id=session_id,
                user_id=user_id,
                title="Debug session",
                timestamp=1234567890,
            )
            feedback = ChatFeedback(
                id=feedback_id,
                user_id=user_id,
                session_id=session_id,
                assistant_message_id="assistant-1",
                user_message_id="user-1",
                rating="down",
                user_message_content="User question",
                assistant_message_content="AI answer",
                assistant_thought="Reasoning",
                feedback_text="Bad answer",
                feedback_images=[{"name": "bug.png", "base64": "ZmFrZQ=="}],
                context_snapshot={"assistant_message": {"content": "AI answer"}},
                created_at=datetime.now(timezone.utc),
            )
            db.add(user)
            db.add(session)
            db.add(feedback)
            db.commit()

        login_response = client.post(
            "/api/dev/login",
            json={"email": "mununum@outlook.com", "password": "a2782282987"},
        )
        assert login_response.status_code == 200

        overview = client.get("/api/dev/overview")
        assert overview.status_code == 200
        assert overview.json()["users"] >= 1
        assert overview.json()["feedback"] >= 1

        feedback_response = client.get("/api/dev/feedback", params={"rating": "down", "limit": 10})
        assert feedback_response.status_code == 200
        assert any(item["id"] == feedback_id for item in feedback_response.json())

        sessions_response = client.get("/api/dev/sessions", params={"limit": 10})
        assert sessions_response.status_code == 200
        assert any(item["id"] == session_id for item in sessions_response.json())
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override
