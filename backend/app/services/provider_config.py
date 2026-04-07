import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from app.core.config import settings


class ProviderConfigService:
    """Service for managing provider configurations in a JSON file."""

    def __init__(self):
        self._config_dir = Path(__file__).parent.parent.parent.parent
        self._config_file = self._config_dir / "providers.json"
        self._config: Dict[str, Any] = {}
        self._load_config()

    def _load_config(self) -> None:
        """Load configuration from JSON file."""
        if self._config_file.exists():
            try:
                with open(self._config_file, 'r', encoding='utf-8') as f:
                    self._config = json.load(f)
            except (json.JSONDecodeError, IOError):
                self._config = self._get_default_config()
        else:
            self._config = self._get_default_config()
            self._save_config()

    def _save_config(self) -> None:
        """Save configuration to JSON file."""
        try:
            with open(self._config_file, 'w', encoding='utf-8') as f:
                json.dump(self._config, f, indent=4, ensure_ascii=False)
        except IOError as e:
            print(f"Failed to save provider config: {e}")

    def _get_default_config(self) -> Dict[str, Any]:
        """Get default provider configuration with Zhipu as initial provider."""
        return {
            "providers": {
                "zhipu": {
                    "name": "Zhipu AI",
                    "base_url": settings.LLM_BASE_URL or "https://open.bigmodel.cn/api/paas/v4/",
                    "api_key": settings.LLM_API_KEY or "",
                    "default_model": "glm-4.7",
                    "supports_vision": True,
                    "models": [
                        {"id": "glm-4.7", "enabled_for_users": True},
                        {"id": "glm-4.6", "enabled_for_users": True},
                        {"id": "glm-4-flash", "enabled_for_users": True},
                        {"id": "glm-4.6v-flash", "enabled_for_users": True}
                    ],
                    "enabled_for_users": True,
                    "enabled": True
                }
            }
        }

    def get_all_providers(self) -> Dict[str, Any]:
        """Get all provider configurations."""
        return self._config.get("providers", {})

    def get_provider(self, provider_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific provider configuration."""
        return self._config.get("providers", {}).get(provider_id)

    def get_enabled_providers_for_users(self) -> Dict[str, Any]:
        """Get providers that are enabled and marked for user selection."""
        providers = self._config.get("providers", {})
        result = {}
        for pid, cfg in providers.items():
            if cfg.get("enabled", False) and cfg.get("enabled_for_users", False):
                filtered_models = [
                    m for m in cfg.get("models", [])
                    if isinstance(m, dict) and m.get("enabled_for_users", False)
                ]
                cfg = {**cfg, "models": filtered_models}
                result[pid] = cfg
        return result

    def add_provider(
        self,
        provider_id: str,
        name: str,
        base_url: str,
        api_key: str,
        default_model: str = "",
        supports_vision: bool = False
    ) -> None:
        """Add a new provider."""
        if "providers" not in self._config:
            self._config["providers"] = {}
        
        self._config["providers"][provider_id] = {
            "name": name,
            "base_url": base_url,
            "api_key": api_key,
            "default_model": default_model,
            "supports_vision": supports_vision,
            "models": [],
            "enabled_for_users": False,
            "enabled": True
        }
        self._save_config()

    def update_provider(self, provider_id: str, config: Dict[str, Any]) -> bool:
        """Update a provider configuration."""
        if "providers" not in self._config or provider_id not in self._config["providers"]:
            return False
        self._config["providers"][provider_id].update(config)
        self._save_config()
        return True

    def remove_provider(self, provider_id: str) -> bool:
        """Remove a provider."""
        if "providers" in self._config and provider_id in self._config["providers"]:
            del self._config["providers"][provider_id]
            self._save_config()
            return True
        return False

    def set_provider_models(self, provider_id: str, models: List[str], default_model: str) -> bool:
        """Set the available models for a provider."""
        if "providers" not in self._config or provider_id not in self._config["providers"]:
            return False
        
        existing_models = self._config["providers"][provider_id].get("models", [])
        
        existing_model_map: Dict[str, Dict[str, Any]] = {}
        for m in existing_models:
            if isinstance(m, dict):
                model_id = m.get("id", "")
                if model_id:
                    existing_model_map[model_id] = m
            elif isinstance(m, str):
                existing_model_map[m] = {"id": m, "enabled_for_users": True}
        
        model_objects = []
        for model_id in models:
            if model_id in existing_model_map:
                model_objects.append(existing_model_map[model_id])
            else:
                model_objects.append({"id": model_id, "enabled_for_users": True})
        
        self._config["providers"][provider_id]["models"] = model_objects
        self._config["providers"][provider_id]["default_model"] = default_model or (models[0] if models else "")
        self._save_config()
        return True

    def toggle_model_for_users(self, provider_id: str, model_id: str, enabled_for_users: bool) -> bool:
        """Toggle whether a specific model is available to users."""
        if "providers" not in self._config or provider_id not in self._config["providers"]:
            return False
        
        models = self._config["providers"][provider_id].get("models", [])
        for i, model in enumerate(models):
            model_id_str = None
            if isinstance(model, dict):
                model_id_str = model.get("id")
            elif isinstance(model, str):
                model_id_str = model
            
            if model_id_str == model_id:
                if isinstance(models[i], dict):
                    models[i]["enabled_for_users"] = enabled_for_users
                else:
                    models[i] = {"id": model_id, "enabled_for_users": enabled_for_users}
                self._save_config()
                return True
        return False

    def get_enabled_models_for_provider(self, provider_id: str) -> List[str]:
        """Get models that are enabled for users within a specific provider."""
        provider = self.get_provider(provider_id)
        if not provider:
            return []
        
        models = provider.get("models", [])
        return [
            m.get("id") for m in models
            if isinstance(m, dict) and m.get("enabled_for_users", False)
        ]

    def toggle_provider_for_users(self, provider_id: str, enabled_for_users: bool) -> bool:
        """Toggle whether a provider's models are available to users."""
        if "providers" not in self._config or provider_id not in self._config["providers"]:
            return False
        self._config["providers"][provider_id]["enabled_for_users"] = enabled_for_users
        self._save_config()
        return True

    def toggle_provider_enabled(self, provider_id: str, enabled: bool) -> bool:
        """Toggle whether a provider is enabled."""
        if "providers" not in self._config or provider_id not in self._config["providers"]:
            return False
        self._config["providers"][provider_id]["enabled"] = enabled
        self._save_config()
        return True

    async def detect_models(
        self,
        provider_id: str,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None
    ) -> List[str]:
        """Detect available models for a provider by querying its models API."""
        provider = self.get_provider(provider_id)
        if not provider:
            return []

        key = api_key or provider.get("api_key", "")
        url = base_url or provider.get("base_url", "")

        if not key:
            return []

        if provider_id == "google":
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
            try:
                import httpx
                async with httpx.AsyncClient() as client:
                    response = await client.get(url)
                    if response.status_code == 200:
                        data = response.json()
                        models = []
                        for m in data.get("models", []):
                            name = m.get("name", "")
                            if name:
                                models.append(name.split("/")[-1])
                        return sorted(models[:20])
                    return []
            except Exception as e:
                print(f"Failed to detect models for {provider_id}: {e}")
                return []

        if provider_id == "zhipu":
            zhipu_url = url.rstrip('/') + "/models"
            try:
                import httpx
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        zhipu_url,
                        headers={"Authorization": f"Bearer {key}"}
                    )
                    if response.status_code == 200:
                        data = response.json()
                        models = []
                        for m in data.get("data", []):
                            model_id = m.get("id", "")
                            if model_id:
                                models.append(model_id)
                        if models:
                            return sorted(models)
            except Exception as e:
                print(f"Failed to detect models for {provider_id}: {e}")
            return ["glm-4.7", "glm-4.6", "glm-4-flash", "glm-4.6v-flash"]

        if provider_id == "openrouter":
            openrouter_url = url.rstrip('/')
            if openrouter_url.endswith('/api/v1'):
                openrouter_url = openrouter_url + "/models"
            elif openrouter_url.endswith('/v1'):
                openrouter_url = openrouter_url + "/models"
            else:
                openrouter_url = openrouter_url + "/api/v1/models"
            try:
                import httpx
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        openrouter_url,
                        headers={"Authorization": f"Bearer {key}"}
                    )
                    if response.status_code == 200:
                        data = response.json()
                        models = []
                        for m in data.get("data", []):
                            model_id = m.get("id", "")
                            if model_id:
                                models.append(model_id)
                        return sorted(models[:30])
            except Exception as e:
                print(f"Failed to detect models for {provider_id}: {e}")
            return []

        url = url.rstrip('/')
        if not url.endswith('/v1'):
            url = url + '/v1'

        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=key, base_url=url)
            models_response = await client.models.list()
            models = [m.id for m in models_response.data]
            return sorted(models)
        except Exception as e:
            print(f"Failed to detect models for {provider_id}: {e}")
            return []


provider_config_service = ProviderConfigService()
