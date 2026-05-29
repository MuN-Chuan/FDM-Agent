from abc import ABC
from typing import Any, AsyncGenerator, Dict, List, Optional
import json
import re
from openai import AsyncOpenAI

from app.services.providers.base_provider import BaseModelProvider


class OpenAICompatibleProvider(BaseModelProvider, ABC):
    """Base class for OpenAI-compatible providers."""

    def __init__(
        self,
        provider_id: str,
        provider_name: str,
        base_url: str,
        api_key: str,
        default_model: str = "gpt-4",
        models: Optional[List[str]] = None
    ):
        self._provider_id = provider_id
        self._provider_name = provider_name
        self._base_url = base_url
        self._api_key = api_key
        self._default_model = default_model
        self._models = models or []

    @property
    def provider_id(self) -> str:
        return self._provider_id

    @property
    def provider_name(self) -> str:
        return self._provider_name

    @property
    def default_model(self) -> str:
        return self._default_model

    @property
    def base_url(self) -> str:
        return self._base_url

    def get_client(self, api_key: Optional[str] = None, base_url: Optional[str] = None) -> AsyncOpenAI:
        """Create an AsyncOpenAI client."""
        key = api_key or self._api_key
        url = base_url or self._base_url
        if url and not url.endswith('/'):
            url += '/'
        return AsyncOpenAI(api_key=key, base_url=url)

    async def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: str,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 8192,
        stream: bool = True,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """Generate a chat completion using OpenAI-compatible API."""
        client = self.get_client(api_key, base_url)

        try:
            create_kwargs: dict = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": stream,
                **kwargs,
            }
            # stream_options 只在流式模式下传递，非流式时不传（传 null 会导致 OpenRouter 400）
            if stream:
                create_kwargs["stream_options"] = {"include_usage": True}

            stream_response = await client.chat.completions.create(**create_kwargs)

            full_text = ""
            usage = None

            if stream:
                async for chunk in stream_response:
                    curr_usage = getattr(chunk, 'usage', None)
                    if curr_usage:
                        prompt_details = getattr(curr_usage, 'prompt_tokens_details', None)
                        cached_tokens = getattr(prompt_details, 'cached_tokens', 0) if prompt_details else 0
                        usage = {
                            "prompt_tokens": getattr(curr_usage, 'prompt_tokens', 0),
                            "completion_tokens": getattr(curr_usage, 'completion_tokens', 0),
                            "total_tokens": getattr(curr_usage, 'total_tokens', 0),
                            "cache_tokens": cached_tokens
                        }

                    if not chunk.choices:
                        continue

                    reasoning = getattr(chunk.choices[0].delta, 'reasoning_content', None)
                    if reasoning:
                        yield self.format_thought(reasoning)

                    content = chunk.choices[0].delta.content
                    if content:
                        full_text += content
                        yield self.format_text(content)

                modifications = self._extract_modifications(full_text)
                yield self.format_done(modifications, usage)
            else:
                response = stream_response
                full_text = response.choices[0].message.content or ""
                modifications = self._extract_modifications(full_text)
                yield self.format_text(full_text)
                yield self.format_done(modifications, usage)

        except Exception as e:
            yield self.format_error(e)

    def _extract_modifications(self, text: str) -> List[Dict[str, Any]]:
        """Extract json_modifications from the response text."""
        modifications = []
        mod_match = re.search(
            r'```json_modifications\s*([\s\S]*?)\s*```',
            text,
            re.DOTALL
        )
        if mod_match:
            try:
                mod_json = mod_match.group(1).strip()
                modifications = json.loads(mod_json)
            except (json.JSONDecodeError, ValueError) as e:
                print(f"[{self._provider_id}] Failed to parse json_modifications: {e}")
        return modifications
