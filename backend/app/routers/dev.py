from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import ChatFeedback, ChatSession, User
from app.db.session import get_db
from app.services.auth_service import auth_service
from app.services.provider_config import provider_config_service
from app.services.providers import provider_registry


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


class ProviderModelUpdate(BaseModel):
    id: str
    enabled_for_users: bool


class ProviderUpdate(BaseModel):
    provider_id: Optional[str] = None
    name: str
    base_url: str
    api_key: str
    default_model: str
    supports_vision: bool = False
    enabled: bool = True
    enabled_for_users: bool = False
    models: List[ProviderModelUpdate] = []


@router.get("/providers")
def get_providers(
    _: str = Depends(require_dev_access),
):
    """Get all provider configurations."""
    return provider_config_service.get_all_providers()


@router.post("/providers")
def add_provider(
    config: ProviderUpdate,
    _: str = Depends(require_dev_access),
):
    """Add a new provider."""
    provider_config_service.add_provider(
        provider_id=config.provider_id,
        name=config.name,
        base_url=config.base_url,
        api_key=config.api_key,
        default_model=config.default_model,
        supports_vision=config.supports_vision
    )
    provider_registry.reload_from_provider_config()
    return {"success": True}


@router.put("/providers/{provider_id}")
def update_provider(
    provider_id: str,
    config: ProviderUpdate,
    _: str = Depends(require_dev_access),
):
    """Update a provider configuration."""
    update_data = {
        "name": config.name,
        "base_url": config.base_url,
        "api_key": config.api_key,
        "default_model": config.default_model,
        "supports_vision": config.supports_vision,
        "enabled": config.enabled,
        "enabled_for_users": config.enabled_for_users,
        "models": [m.model_dump() for m in config.models],
    }
    success = provider_config_service.update_provider(provider_id, update_data)
    if not success:
        raise HTTPException(status_code=404, detail="Provider not found")
    provider_registry.reload_from_provider_config()
    return {"success": True}


@router.delete("/providers/{provider_id}")
def delete_provider(
    provider_id: str,
    _: str = Depends(require_dev_access),
):
    """Delete a provider."""
    success = provider_config_service.remove_provider(provider_id)
    if not success:
        raise HTTPException(status_code=404, detail="Provider not found")
    provider_registry.reload_from_provider_config()
    return {"success": True}


@router.post("/providers/{provider_id}/detect")
async def detect_models(
    provider_id: str,
    _: str = Depends(require_dev_access),
):
    """Auto-detect available models for a provider."""
    provider = provider_config_service.get_provider(provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    models = await provider_config_service.detect_models(provider_id)
    
    if models and provider.get("enabled", True):
        provider_config_service.set_provider_models(provider_id, models, models[0] if models else "")
        provider_registry.reload_from_provider_config()
    
    return {"models": models}


@router.post("/providers/{provider_id}/toggle-users")
def toggle_provider_for_users(
    provider_id: str,
    enabled_for_users: bool,
    _: str = Depends(require_dev_access),
):
    """Toggle whether a provider's models are available to users."""
    success = provider_config_service.toggle_provider_for_users(provider_id, enabled_for_users)
    if not success:
        raise HTTPException(status_code=404, detail="Provider not found")
    return {"success": True}


class ModelToggleRequest(BaseModel):
    model_id: str
    enabled_for_users: bool


@router.post("/providers/{provider_id}/models/toggle")
def toggle_model_for_users(
    provider_id: str,
    request: ModelToggleRequest,
    _: str = Depends(require_dev_access),
):
    """Toggle whether a specific model is available to users."""
    success = provider_config_service.toggle_model_for_users(provider_id, request.model_id, request.enabled_for_users)
    if not success:
        raise HTTPException(status_code=404, detail="Model not found")
    return {"success": True}


@router.get("/providers/enabled-for-users")
def get_enabled_providers_for_users(
    _: str = Depends(require_dev_access),
):
    """Get providers that are enabled for user selection."""
    return provider_config_service.get_enabled_providers_for_users()


@router.get("/providers/public")
def get_public_providers():
    """Get providers that are enabled for user selection (no auth required for regular users)."""
    return provider_config_service.get_enabled_providers_for_users()
