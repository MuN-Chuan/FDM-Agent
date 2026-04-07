from typing import Any, AsyncGenerator, Dict, List, Optional

from app.core.config import settings
from app.services.providers.openai_compatible_provider import OpenAICompatibleProvider


class MiniMaxProvider(OpenAICompatibleProvider):
    """MiniMax AI provider."""

    def __init__(self):
        super().__init__(
            provider_id="minimax",
            provider_name="MiniMax",
            base_url=settings.MINIMAX_BASE_URL or "https://api.minimax.chat/v1",
            api_key=settings.MINIMAX_API_KEY or "",
            default_model="MiniMax-Text-01",
            models=[
                "MiniMax-Text-01",
                "abab6.5s-chat",
                "abab6.5g-chat",
                "abab5.5s-chat",
            ]
        )

    @property
    def supports_vision(self) -> bool:
        return False

    def get_available_models(self) -> List[str]:
        """Return list of available MiniMax models."""
        return self._models.copy()
