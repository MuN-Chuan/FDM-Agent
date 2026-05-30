from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.models import ChatFeedback, ChatSession
from app.db.session import get_db
from app.main import app


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    future=True,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db: Session = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


def test_chat_sessions_can_be_saved_without_authentication() -> None:
    payload = {
        "id": "chat-1",
        "title": "Local session",
        "timestamp": 1,
        "messages": [{"id": "m1", "role": "user", "content": "hello"}],
        "modifications": [],
        "selection": None,
        "bundle": None,
        "presetFileName": None,
    }

    response = client.put("/api/chat/sessions/chat-1", json=payload)

    assert response.status_code == 200
    assert response.json()["id"] == "chat-1"

    with TestingSessionLocal() as session:
        saved = session.scalar(select(ChatSession).where(ChatSession.id == "chat-1"))
        assert saved is not None
        assert saved.title == "Local session"


def test_submit_chat_feedback_persists_snapshot() -> None:
    payload = {
        "session_id": "chat-1",
        "assistant_message_id": "assistant-1",
        "user_message_id": "user-1",
        "rating": "down",
        "feedback_text": "The answer missed the key preset issue.",
        "feedback_images": [
            {
                "name": "result.png",
                "base64": "ZmFrZS1pbWFnZQ==",
                "preview_url": "data:image/png;base64,ZmFrZS1pbWFnZQ==",
            }
        ],
        "context_snapshot": {
            "model_name": "gpt-4o-mini",
            "user_message": {
                "id": "user-1",
                "role": "user",
                "content": "Why is my print stringing so badly?",
                "attachments": [{"name": "notes.txt", "size": 12, "content": "printer notes"}],
                "image": {"name": "print.png", "base64": "abc123", "preview_url": "data:image/png;base64,abc123"},
                "preset": {"file_name": "pla.zip", "bundle_format": "orca"},
            },
            "assistant_message": {
                "id": "assistant-1",
                "role": "assistant",
                "content": "Try slowing down the print.",
                "thought": "Checking likely causes",
            },
            "conversation_history": [
                {"role": "user", "content": "Why is my print stringing so badly?"},
            ],
        },
    }

    response = client.post("/api/chat/feedback", json=payload)

    assert response.status_code == 200
    assert response.json()["message"] == "Feedback saved"

    with TestingSessionLocal() as session:
        saved = session.scalar(select(ChatFeedback).where(ChatFeedback.assistant_message_id == "assistant-1"))

        assert saved is not None
        assert saved.rating == "down"
        assert saved.feedback_text == "The answer missed the key preset issue."
        assert saved.user_message_content == "Why is my print stringing so badly?"
        assert saved.assistant_message_content == "Try slowing down the print."
        assert saved.context_snapshot["user_message"]["preset"]["file_name"] == "pla.zip"
        assert saved.feedback_images[0]["name"] == "result.png"
