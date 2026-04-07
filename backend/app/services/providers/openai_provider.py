from typing import Any, AsyncGenerator, Dict, List, Optional

from app.core.config import settings
from app.services.providers.openai_compatible_provider import OpenAICompatibleProvider


class OpenAIProvider(OpenAICompatibleProvider):
    """OpenAI provider supporting GPT models."""

    def __init__(self):
        super().__init__(
            provider_id="openai",
            provider_name="OpenAI",
            base_url=settings.OPENAI_BASE_URL or "https://api.openai.com/v1/",
            api_key=settings.OPENAI_API_KEY or "",
            default_model="gpt-4o",
            models=[
                "gpt-4o",
                "gpt-4o-mini",
                "gpt-4-turbo",
                "gpt-4",
                "gpt-3.5-turbo",
            ]
        )

    @property
    def supports_vision(self) -> bool:
        return True

    def get_available_models(self) -> List[str]:
        """Return list of available GPT models."""
        return self._models.copy()
