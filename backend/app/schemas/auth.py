from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    invite_code: str | None = Field(default=None, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    role: str
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None = None


class AuthResponse(BaseModel):
    user: UserResponse


class MessageResponse(BaseModel):
    message: str


class RegistrationPolicyResponse(BaseModel):
    mode: str
    invite_required: bool
    registration_enabled: bool
