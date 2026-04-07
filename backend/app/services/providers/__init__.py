from typing import Any, Dict, Optional, List
from app.services.providers.base_provider import BaseModelProvider, ProviderConfig
from app.services.providers.zhipu_provider import ZhipuProvider, ZhipuVisionProvider
from app.services.providers.openai_provider import OpenAIProvider
from app.services.providers.openrouter_provider import OpenRouterProvider
from app.services.providers.google_provider import GoogleProvider
from app.services.providers.minimax_provider import MiniMaxProvider
from app.services.providers.custom_provider import CustomOpenAICompatibleProvider


class ProviderRegistry:
    """Registry for managing all available model providers."""

    def __init__(self):
        self._providers: Dict[str, BaseModelProvider] = {}
        self._provider_configs: Dict[str, ProviderConfig] = {}
        self._register_default_providers()
        self._load_from_provider_config()

    def _register_default_providers(self):
        """Register all built-in providers."""
        providers = [
            ZhipuProvider(),
            OpenRouterProvider(),
            OpenAIProvider(),
            GoogleProvider(),
            MiniMaxProvider(),
        ]

        for provider in providers:
            self.register_provider(provider)

    def _load_from_provider_config(self):
        """Load provider configurations from provider_config.json."""
        try:
            from app.services.provider_config import provider_config_service
            providers_config = provider_config_service.get_all_providers()
            for provider_id, config in providers_config.items():
                models = config.get("models", [])
                model_ids = [m.get("id") if isinstance(m, dict) else m for m in models]
                
                if provider_id in self._providers:
                    provider = self._providers[provider_id]
                    api_key = config.get("api_key", "")
                    if api_key:
                        provider._api_key = api_key
                    base_url = config.get("base_url", "")
                    if base_url:
                        provider._base_url = base_url
                    default_model = config.get("default_model", "")
                    if default_model:
                        provider._default_model = default_model
                    if model_ids:
                        if hasattr(provider, 'set_models'):
                            provider.set_models(model_ids)
                        provider._models = model_ids
                    
                    self._provider_configs[provider_id] = ProviderConfig(
                        provider_id=provider_id,
                        name=config.get("name", provider.provider_name),
                        base_url=config.get("base_url", provider.base_url),
                        api_key=config.get("api_key", ""),
                        default_model=default_model or provider.default_model,
                        supports_vision=config.get("supports_vision", provider.supports_vision),
                        models=model_ids
                    )
                else:
                    self.register_custom_provider(
                        provider_id=provider_id,
                        name=config.get("name", provider_id),
                        base_url=config.get("base_url", ""),
                        api_key=config.get("api_key", ""),
                        default_model=config.get("default_model", ""),
                        supports_vision=config.get("supports_vision", False),
                        models=model_ids
                    )
        except Exception as e:
            print(f"Failed to load providers from config: {e}")

    def reload_from_provider_config(self):
        """Reload provider configurations from provider_config.json."""
        self._load_from_provider_config()

    def register_provider(self, provider: BaseModelProvider):
        """Register a provider."""
        self._providers[provider.provider_id] = provider
        self._provider_configs[provider.provider_id] = ProviderConfig(
            provider_id=provider.provider_id,
            name=provider.provider_name,
            base_url=getattr(provider, '_base_url', None),
            default_model=provider.default_model,
            supports_vision=provider.supports_vision,
            models=getattr(provider, '_models', [])
        )

    def register_custom_provider(
        self,
        provider_id: str,
        name: str,
        base_url: str,
        api_key: str,
        default_model: str = "",
        supports_vision: bool = False,
        models: List[str] = None
    ) -> CustomOpenAICompatibleProvider:
        """Register a custom OpenAI-compatible provider."""
        provider = CustomOpenAICompatibleProvider(
            provider_id=provider_id,
            name=name,
            base_url=base_url,
            api_key=api_key,
            default_model=default_model,
            supports_vision=supports_vision
        )
        if models:
            provider.set_models(models)
        self.register_provider(provider)
        return provider

    def get_provider(self, provider_id: str) -> Optional[BaseModelProvider]:
        """Get a provider by ID."""
        return self._providers.get(provider_id)

    def get_provider_config(self, provider_id: str) -> Optional[ProviderConfig]:
        """Get provider configuration by ID."""
        return self._provider_configs.get(provider_id)

    def list_providers(self) -> List[ProviderConfig]:
        """List all registered provider configurations."""
        return list(self._provider_configs.values())

    def get_provider_ids(self) -> List[str]:
        """Get all registered provider IDs."""
        return list(self._providers.keys())

    def update_provider_models(self, provider_id: str, models: List[str], default_model: str) -> bool:
        """Update the available models for a provider."""
        provider = self._providers.get(provider_id)
        if not provider:
            return False
        
        if hasattr(provider, 'set_models'):
            provider.set_models(models)
        
        if hasattr(provider, '_models'):
            provider._models = models
        
        provider_config = self._provider_configs.get(provider_id)
        if provider_config:
            provider_config.models = models
            provider_config._Config__dict__["default_model"] = default_model if hasattr(provider_config, '_Config__dict__') else default_model
        
        return True


provider_registry = ProviderRegistry()
