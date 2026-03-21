from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    invite_code: str | None = Field(default=None, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class EmailCodeRequest(BaseModel):
    email: EmailStr
    purpose: Literal["login", "register"] = "login"


class EmailCodeLoginRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=8)


class EmailCodeRegisterRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=8)
    invite_code: str | None = Field(default=None, max_length=128)


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    role: str
    points_balance: int
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None = None


class AuthResponse(BaseModel):
    user: UserResponse


class MessageResponse(BaseModel):
    message: str


class EmailCodeResponse(MessageResponse):
    debug_code: str | None = None


class RegistrationPolicyResponse(BaseModel):
    mode: str
    invite_required: bool
    registration_enabled: bool
