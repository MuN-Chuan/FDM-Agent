from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import User
from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    RegistrationPolicyResponse,
    UserResponse,
)
from app.services.auth_service import auth_service
from app.services.rate_limit_service import build_rate_limit_dependency


router = APIRouter(prefix="/api/auth", tags=["auth"])
auth_rate_limit = build_rate_limit_dependency(
    scope="auth",
    max_requests=settings.AUTH_RATE_LIMIT_MAX_REQUESTS,
    window_seconds=settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
)


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    cookie_kwargs = {
        "httponly": True,
        "secure": settings.COOKIE_SECURE,
        "samesite": settings.COOKIE_SAMESITE,
        "domain": settings.COOKIE_DOMAIN,
        "path": "/",
    }
    response.set_cookie(
        key=settings.ACCESS_COOKIE_NAME,
        value=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        **cookie_kwargs,
    )
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        **cookie_kwargs,
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(
        key=settings.ACCESS_COOKIE_NAME,
        domain=settings.COOKIE_DOMAIN,
        path="/",
    )
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        domain=settings.COOKIE_DOMAIN,
        path="/",
    )


def _serialize_user(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    _: None = Depends(auth_rate_limit),
):
    try:
        user = auth_service.register_user(db, payload.email, payload.password, payload.invite_code)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    auth_service.touch_login(db, user)
    access_token = auth_service.create_access_token(user)
    refresh_token = auth_service.create_refresh_token(
        db,
        user,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    _set_auth_cookies(response, access_token, refresh_token)
    return AuthResponse(user=_serialize_user(user))


@router.get("/register-policy", response_model=RegistrationPolicyResponse)
def get_registration_policy():
    policy = auth_service.get_registration_policy()
    return RegistrationPolicyResponse(**policy)


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    _: None = Depends(auth_rate_limit),
):
    user = auth_service.authenticate_user(db, payload.email.lower(), payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    auth_service.touch_login(db, user)
    access_token = auth_service.create_access_token(user)
    refresh_token = auth_service.create_refresh_token(
        db,
        user,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    _set_auth_cookies(response, access_token, refresh_token)
    return AuthResponse(user=_serialize_user(user))


@router.post("/refresh", response_model=AuthResponse)
def refresh_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: str | None = Cookie(default=None, alias=settings.REFRESH_COOKIE_NAME),
    _: None = Depends(auth_rate_limit),
):
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")

    try:
        user, new_refresh_token = auth_service.rotate_refresh_token(
            db,
            refresh_token,
            user_agent=request.headers.get("user-agent"),
            ip_address=request.client.host if request.client else None,
        )
    except ValueError as exc:
        _clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    access_token = auth_service.create_access_token(user)
    _set_auth_cookies(response, access_token, new_refresh_token)
    return AuthResponse(user=_serialize_user(user))


@router.post("/logout", response_model=MessageResponse)
def logout(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: str | None = Cookie(default=None, alias=settings.REFRESH_COOKIE_NAME),
    _: None = Depends(auth_rate_limit),
):
    if refresh_token:
        auth_service.revoke_refresh_token(db, refresh_token)
    _clear_auth_cookies(response)
    return MessageResponse(message="Logged out")


@router.get("/me", response_model=AuthResponse)
def me(current_user: User = Depends(get_current_user)):
    return AuthResponse(user=_serialize_user(current_user))
