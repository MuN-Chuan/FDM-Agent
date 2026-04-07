from typing import Any, AsyncGenerator, Dict, List, Optional

from app.core.config import settings
from app.services.providers.openai_compatible_provider import OpenAICompatibleProvider


class ZhipuProvider(OpenAICompatibleProvider):
    """Zhipu AI (智谱) provider supporting GLM models."""

    def __init__(self):
        super().__init__(
            provider_id="zhipu",
            provider_name="Zhipu AI",
            base_url=settings.LLM_BASE_URL or "https://open.bigmodel.cn/api/paas/v4/",
            api_key=settings.LLM_API_KEY or "",
            default_model=settings.LLM_MODEL_NAME or "glm-4.7",
            models=[
                "glm-4.7",
                "glm-4.6",
                "glm-4-flash",
                "glm-4.6v-flash",
                "glm-z1.5",
                "glm-z1.",
            ]
        )

    @property
    def supports_vision(self) -> bool:
        return True

    def get_available_models(self) -> List[str]:
        """Return list of available GLM models."""
        return self._models.copy()


class ZhipuVisionProvider(OpenAICompatibleProvider):
    """Zhipu AI vision model provider."""

    def __init__(self):
        super().__init__(
            provider_id="zhipu-vision",
            provider_name="Zhipu AI (Vision)",
            base_url=settings.LLM_BASE_URL or "https://open.bigmodel.cn/api/paas/v4/",
            api_key=settings.LLM_API_KEY or "",
            default_model="glm-4.6v-flash",
            models=[
                "glm-4.6v-flash",
                "glm-4v-flash",
            ]
        )

    @property
    def supports_vision(self) -> bool:
        return True
