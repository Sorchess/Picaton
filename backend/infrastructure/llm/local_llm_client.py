"""Async client for local LLM via llama.cpp server."""

import json
import logging
from dataclasses import dataclass
from typing import AsyncGenerator

import httpx

from settings.config import settings

logger = logging.getLogger(__name__)


@dataclass
class LocalLLMResponse:
    """Response from local LLM."""

    content: str
    tokens_used: int
    model: str


class LocalLLMError(Exception):
    """Local LLM error."""

    def __init__(self, message: str, status_code: int | None = None):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class LocalLLMClient:
    """
    Async client for local LLM via llama.cpp server.

    Uses OpenAI-compatible chat completions endpoint.
    Supports both regular and streaming completions.
    """

    def __init__(self):
        self._config = settings.local_llm
        self._base_url = f"{self._config.base_url}/v1/chat/completions"

    @property
    def is_configured(self) -> bool:
        """Check if local LLM is configured and enabled."""
        return self._config.enabled

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> LocalLLMResponse:
        """
        Generate completion using local LLM.

        Args:
            system_prompt: System message for the model
            user_prompt: User message to complete
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0-2)

        Returns:
            LocalLLMResponse with generated content

        Raises:
            LocalLLMError: If API call fails
        """
        if not self.is_configured:
            raise LocalLLMError("Local LLM is not enabled")

        max_tokens = max_tokens or self._config.max_tokens
        temperature = temperature if temperature is not None else self._config.temperature

        payload = {
            "model": self._config.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": False,
        }

        try:
            async with httpx.AsyncClient(timeout=self._config.timeout) as client:
                response = await client.post(self._base_url, json=payload)
                response.raise_for_status()
                data = response.json()

                return LocalLLMResponse(
                    content=data["choices"][0]["message"]["content"],
                    tokens_used=data.get("usage", {}).get("total_tokens", 0),
                    model=data.get("model", self._config.model),
                )

        except httpx.TimeoutException:
            logger.error("Local LLM request timeout")
            raise LocalLLMError("Request timeout")

        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP error: {e.response.status_code}"
            try:
                error_data = e.response.json()
                error_msg = error_data.get("error", {}).get("message", error_msg)
            except json.JSONDecodeError:
                pass
            logger.error(f"Local LLM HTTP error: {error_msg}")
            raise LocalLLMError(error_msg, status_code=e.response.status_code)

        except httpx.RequestError as e:
            logger.error(f"Local LLM request error: {e}")
            raise LocalLLMError(f"Request failed: {str(e)}")

    async def stream_complete(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream completion using SSE.

        Yields text chunks as they are generated.
        Used for typewriter effect in UI.

        Args:
            system_prompt: System message for the model
            user_prompt: User message to complete
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature

        Yields:
            Text chunks as they are generated

        Raises:
            LocalLLMError: If connection fails
        """
        if not self.is_configured:
            raise LocalLLMError("Local LLM is not enabled")

        max_tokens = max_tokens or self._config.max_tokens
        temperature = temperature if temperature is not None else self._config.temperature

        payload = {
            "model": self._config.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
        }

        try:
            async with httpx.AsyncClient(timeout=self._config.timeout) as client:
                async with client.stream("POST", self._base_url, json=payload) as response:
                    response.raise_for_status()

                    async for line in response.aiter_lines():
                        if not line:
                            continue

                        if line.startswith("data: "):
                            data = line[6:]  # Remove "data: " prefix

                            if data == "[DONE]":
                                break

                            try:
                                chunk = json.loads(data)
                                delta = chunk.get("choices", [{}])[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                            except json.JSONDecodeError:
                                logger.warning(f"Failed to parse SSE chunk: {data}")
                                continue

        except httpx.TimeoutException:
            logger.error("Local LLM streaming timeout")
            raise LocalLLMError("Streaming timeout")

        except httpx.HTTPStatusError as e:
            logger.error(f"Local LLM streaming HTTP error: {e.response.status_code}")
            raise LocalLLMError(f"HTTP error: {e.response.status_code}", status_code=e.response.status_code)

        except httpx.RequestError as e:
            logger.error(f"Local LLM streaming request error: {e}")
            raise LocalLLMError(f"Streaming failed: {str(e)}")

    async def complete_json(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int | None = None,
    ) -> list | dict:
        """
        Generate JSON completion.

        Args:
            system_prompt: System message (should instruct JSON output)
            user_prompt: User message
            max_tokens: Maximum tokens

        Returns:
            Parsed JSON (list or dict)

        Raises:
            LocalLLMError: If API call or JSON parsing fails
        """
        import re

        response = await self.complete(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=max_tokens,
            temperature=0.3,  # Lower temperature for structured output
        )

        content = response.content.strip()

        # Try to parse JSON directly
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # Try to extract JSON array from response
        array_match = re.search(r"\[.*\]", content, re.DOTALL)
        if array_match:
            try:
                return json.loads(array_match.group())
            except json.JSONDecodeError:
                pass

        # Try to extract JSON object from response
        obj_match = re.search(r"\{.*\}", content, re.DOTALL)
        if obj_match:
            try:
                return json.loads(obj_match.group())
            except json.JSONDecodeError:
                pass

        raise LocalLLMError(f"Failed to parse JSON from response: {content[:200]}")

    async def health_check(self) -> bool:
        """
        Check if local LLM server is healthy.

        Returns:
            True if server is responding, False otherwise
        """
        if not self.is_configured:
            return False

        try:
            health_url = f"{self._config.base_url}/health"
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(health_url)
                return response.status_code == 200
        except Exception:
            return False
