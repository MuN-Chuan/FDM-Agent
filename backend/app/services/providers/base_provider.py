from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator, Dict, List, Optional
import json


class BaseModelProvider(ABC):
    """Abstract base class for AI model providers."""

    @property
    @abstractmethod
    def provider_id(self) -> str:
        """Unique identifier for this provider."""
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Human-readable name for this provider."""
        pass

    @property
    @abstractmethod
    def default_model(self) -> str:
        """Default model for this provider."""
        pass

    @property
    def supports_streaming(self) -> bool:
        """Whether this provider supports streaming responses."""
        return True

    @abstractmethod
    async def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 8192,
        stream: bool = True,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Generate a chat completion.

        Yields SSE-formatted strings like:
        - data: {"type": "thought", "content": "..."}
        - data: {"type": "text", "content": "..."}
        - data: {"type": "done", "modifications": [], "usage": {...}}
        - data: {"type": "error", "message": "..."}
        """
        pass

    def format_error(self, error: Exception) -> str:
        """Format an error as an SSE data string."""
        return f'data: {json.dumps({"type": "error", "message": str(error)}, ensure_ascii=False)}\n\n'

    def format_thought(self, content: str) -> str:
        """Format a thought/reasoning as an SSE data string."""
        return f'data: {json.dumps({"type": "thought", "content": content}, ensure_ascii=False)}\n\n'

    def format_text(self, content: str) -> str:
        """Format text content as an SSE data string."""
        return f'data: {json.dumps({"type": "text", "content": content}, ensure_ascii=False)}\n\n'

    def format_done(
        self,
        modifications: List[Dict[str, Any]] = None,
        usage: Dict[str, Any] = None
    ) -> str:
        """Format a completion signal as an SSE data string."""
        return f'data: {json.dumps({"type": "done", "modifications": modifications or [], "usage": usage}, ensure_ascii=False)}\n\n'

    def is_reasoning_model(self, model: str) -> bool:
        """Check if the model is a reasoning model that outputs thought content."""
        reasoning_keywords = ['r1', 'reasoning', 'think', 'o1', 'o3', 'o4']
        model_lower = model.lower()
        return any(keyword in model_lower for keyword in reasoning_keywords)


class ProviderConfig:
    """Configuration for a model provider."""

    def __init__(
        self,
        provider_id: str,
        name: str,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        default_model: Optional[str] = None,
        supports_vision: bool = False,
        models: Optional[List[str]] = None
    ):
        self.provider_id = provider_id
        self.name = name
        self.base_url = base_url
        self.api_key = api_key
        self.default_model = default_model
        self.supports_vision = supports_vision
        self.models = models or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "provider_id": self.provider_id,
            "name": self.name,
            "base_url": self.base_url,
            "default_model": self.default_model,
            "supports_vision": self.supports_vision,
            "models": self.models
        }
