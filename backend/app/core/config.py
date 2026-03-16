from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "FDM AI Diagnosis API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://open.bigmodel.cn/api/paas/v4/"
    LLM_MODEL_NAME: str = "glm-4.7"

    DATABASE_URL: str = "sqlite:///./fdm_ai_web.db"
    AUTO_CREATE_TABLES: bool = False
    DB_POOL_SIZE: int = 3
    DB_MAX_OVERFLOW: int = 2

    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14
    ACCESS_COOKIE_NAME: str = "fdm_access_token"
    REFRESH_COOKIE_NAME: str = "fdm_refresh_token"
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"
    COOKIE_DOMAIN: str | None = None
    AUTH_RATE_LIMIT_MAX_REQUESTS: int = 10
    AUTH_RATE_LIMIT_WINDOW_SECONDS: int = 60
    CHAT_RATE_LIMIT_MAX_REQUESTS: int = 30
    CHAT_RATE_LIMIT_WINDOW_SECONDS: int = 60
    CHAT_STREAM_RATE_LIMIT_MAX_REQUESTS: int = 12
    CHAT_STREAM_RATE_LIMIT_WINDOW_SECONDS: int = 60
    REGISTRATION_MODE: str = "open"
    INVITE_CODES: list[str] = Field(default_factory=list)

    CORS_ORIGINS: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
        ]
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


settings = Settings()
