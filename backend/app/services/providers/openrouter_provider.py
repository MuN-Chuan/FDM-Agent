from typing import Any, AsyncGenerator, Dict, List, Optional

from app.core.config import settings
from app.services.providers.openai_compatible_provider import OpenAICompatibleProvider


class OpenRouterProvider(OpenAICompatibleProvider):
    """OpenRouter provider - unified API for multiple LLM providers."""

    def __init__(self):
        super().__init__(
            provider_id="openrouter",
            provider_name="OpenRouter",
            base_url=settings.OPENROUTER_BASE_URL or "https://openrouter.ai/api/v1",
            api_key=settings.OPENROUTER_API_KEY or "",
            default_model="openrouter/auto",
            models=[
                "openrouter/auto",
                "openai/gpt-4o",
                "openai/gpt-4o-mini",
                "openai/gpt-4-turbo",
                "anthropic/claude-3.5-sonnet",
                "anthropic/claude-3-haiku",
                "google/gemini-pro-1.5",
                "google/gemini-flash-1.5",
                "deepseek/deepseek-chat",
                "deepseek/deepseek-coder",
                "mistral/mistral-large",
                "mistral/mistral-7b",
                "qwen/qwen-2-72b",
                "qwen/qwen-2-7b",
                "bytedance/ui-tars-1.5-7b",
            ]
        )

    @property
    def supports_vision(self) -> bool:
        return True

    def get_available_models(self) -> List[str]:
        """Return list of available models through OpenRouter."""
        return self._models.copy()
