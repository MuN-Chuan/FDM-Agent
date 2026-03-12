import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # API Settings
    PROJECT_NAME: str = "FDM AI Diagnosis API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    # LLM Configuration (e.g., ZhipuAI / GLM-4)
    # Defaulting to the provided API Key for GLM-4.7
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "631c525fba06453e94ae5f6e15e76002.ArNCPbC4aGgiT3Wi")
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "https://open.bigmodel.cn/api/paas/v4/")
    LLM_MODEL_NAME: str = os.getenv("LLM_MODEL_NAME", "glm-4.7")

    # CORS Settings
    CORS_ORIGINS: list = ["*"]

    class Config:
        case_sensitive = True

settings = Settings()
