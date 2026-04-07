from typing import Any, Dict, List, Optional

from app.services.providers.openai_compatible_provider import OpenAICompatibleProvider


class CustomOpenAICompatibleProvider(OpenAICompatibleProvider):
    """Custom OpenAI-compatible provider for user-defined endpoints."""

    def __init__(
        self,
        provider_id: str,
        name: str,
        base_url: str,
        api_key: str,
        default_model: str = "",
        supports_vision: bool = False
    ):
        super().__init__(
            provider_id=f"custom_{provider_id}",
            provider_name=name,
            base_url=base_url,
            api_key=api_key,
            default_model=default_model,
            models=[]
        )
        self._supports_vision = supports_vision
        self._custom_models: List[str] = []

    @property
    def supports_vision(self) -> bool:
        return self._supports_vision

    def set_models(self, models: List[str]) -> None:
        """Set the available models for this provider."""
        self._custom_models = models

    def get_available_models(self) -> List[str]:
        """Return list of available models."""
        return self._custom_models.copy()
