from typing import Any, AsyncGenerator, Dict, List, Optional

from app.core.config import settings
from app.services.providers.openai_compatible_provider import OpenAICompatibleProvider


class GoogleProvider(OpenAICompatibleProvider):
    """Google AI (Gemini) provider."""

    def __init__(self):
        super().__init__(
            provider_id="google",
            provider_name="Google AI",
            base_url=settings.GOOGLE_BASE_URL or "https://generativelanguage.googleapis.com/v1beta/",
            api_key=settings.GOOGLE_API_KEY or "",
            default_model="gemini-2.0-flash",
            models=[
                "gemini-2.0-flash",
                "gemini-2.0-flash-exp",
                "gemini-1.5-pro",
                "gemini-1.5-flash",
                "gemini-1.5-flash-8b",
                "gemini-pro",
                "gemini-pro-vision",
            ]
        )

    @property
    def supports_vision(self) -> bool:
        return True

    def get_available_models(self) -> List[str]:
        """Return list of available Gemini models."""
        return self._models.copy()
