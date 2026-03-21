from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import ChatFeedback, ChatSession, User
from app.db.session import get_db
from app.services.auth_service import auth_service


router = APIRouter(prefix="/api/dev", tags=["developer"])


class DevLoginPayload(BaseModel):
    email: EmailStr
    password: str


def _set_dev_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.DEV_ACCESS_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        max_age=settings.DEV_ACCESS_TOKEN_EXPIRE_HOURS * 3600,
        path="/",
    )


def _clear_dev_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.DEV_ACCESS_COOKIE_NAME,
        domain=settings.COOKIE_DOMAIN,
        path="/",
    )


def require_dev_access(
    dev_token: str | None = Cookie(default=None, alias=settings.DEV_ACCESS_COOKIE_NAME),
) -> str:
    if not dev_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Developer authentication required")

    email = auth_service.parse_dev_email_from_access_token(dev_token)
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Developer authentication required")

    return email


@router.post("/login")
def dev_login(payload: DevLoginPayload, response: Response):
    if not auth_service.verify_dev_credentials(payload.email, payload.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid developer credentials")

    token = auth_service.create_dev_access_token(payload.email.lower())
    _set_dev_cookie(response, token)
    return {"authenticated": True, "email": payload.email.lower()}


@router.post("/logout")
def dev_logout(response: Response):
    _clear_dev_cookie(response)
    return {"authenticated": False}


@router.get("/me")
def dev_me(email: str = Depends(require_dev_access)):
    return {"authenticated": True, "email": email}


@router.get("/overview")
def get_dev_overview(
    _: str = Depends(require_dev_access),
    db: Session = Depends(get_db),
):
    return {
        "users": db.scalar(select(func.count()).select_from(User)) or 0,
        "chat_sessions": db.scalar(select(func.count()).select_from(ChatSession)) or 0,
        "feedback": db.scalar(select(func.count()).select_from(ChatFeedback)) or 0,
        "negative_feedback": db.scalar(
            select(func.count()).select_from(ChatFeedback).where(ChatFeedback.rating == "down")
        )
        or 0,
    }


@router.get("/feedback")
def list_chat_feedback(
    rating: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    _: str = Depends(require_dev_access),
    db: Session = Depends(get_db),
):
    stmt = select(ChatFeedback).order_by(ChatFeedback.created_at.desc()).limit(limit)
    if rating in {"up", "down"}:
        stmt = stmt.where(ChatFeedback.rating == rating)

    items = db.scalars(stmt).all()
    return [
        {
            "id": item.id,
            "session_id": item.session_id,
            "user_id": item.user_id,
            "assistant_message_id": item.assistant_message_id,
            "user_message_id": item.user_message_id,
            "rating": item.rating,
            "user_message_content": item.user_message_content,
            "assistant_message_content": item.assistant_message_content,
            "assistant_thought": item.assistant_thought,
            "feedback_text": item.feedback_text,
            "feedback_images": item.feedback_images or [],
            "context_snapshot": item.context_snapshot,
            "created_at": item.created_at,
        }
        for item in items
    ]


@router.get("/sessions")
def list_recent_sessions(
    limit: int = Query(default=50, ge=1, le=200),
    _: str = Depends(require_dev_access),
    db: Session = Depends(get_db),
):
    sessions = db.scalars(select(ChatSession).order_by(ChatSession.updated_at.desc()).limit(limit)).all()
    return [
        {
            "id": session.id,
            "user_id": session.user_id,
            "title": session.title,
            "timestamp": session.timestamp,
            "preset_file_name": session.preset_file_name,
            "message_count": len(session.messages),
            "created_at": session.created_at,
            "updated_at": session.updated_at,
        }
        for session in sessions
    ]
