"""Async client for Groq LLM API."""

import json
import logging
from dataclasses import dataclass

import httpx

from settings.config import settings

logger = logging.getLogger(__name__)


@dataclass
class GroqResponse:
    """Response from Groq API."""

    content: str
    tokens_used: int
    model: str


class GroqError(Exception):
    """Groq API error."""

    def __init__(self, message: str, status_code: int | None = None):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class GroqClient:
    """
    Async client for Groq API.

    Uses OpenAI-compatible chat completions endpoint.
    """

    BASE_URL = "https://api.groq.com/openai/v1/chat/completions"
    TIMEOUT = 30.0
    MAX_RETRIES = 2

    def __init__(self):
        self._api_key = settings.groq.api_key
        self._model = settings.groq.model
        self._default_max_tokens = settings.groq.max_tokens
        self._default_temperature = settings.groq.temperature

    @property
    def is_configured(self) -> bool:
        """Check if Groq API is configured."""
        return bool(self._api_key)

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> GroqResponse:
        """
        Generate completion using Groq API.

        Args:
            system_prompt: System message for the model
            user_prompt: User message to complete
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0-2)

        Returns:
            GroqResponse with generated content

        Raises:
            GroqError: If API call fails
        """
        if not self.is_configured:
            raise GroqError("Groq API key not configured")

        max_tokens = max_tokens or self._default_max_tokens
        temperature = temperature if temperature is not None else self._default_temperature

        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        for attempt in range(self.MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=self.TIMEOUT) as client:
                    response = await client.post(
                        self.BASE_URL,
                        headers=headers,
                        json=payload,
                    )

                    if response.status_code == 429:
                        # Rate limited - log and raise
                        logger.warning("Groq rate limit exceeded")
                        raise GroqError("Rate limit exceeded", status_code=429)

                    response.raise_for_status()
                    data = response.json()

                    return GroqResponse(
                        content=data["choices"][0]["message"]["content"],
                        tokens_used=data.get("usage", {}).get("total_tokens", 0),
                        model=data.get("model", self._model),
                    )

            except httpx.TimeoutException:
                if attempt < self.MAX_RETRIES:
                    logger.warning(f"Groq timeout, retrying (attempt {attempt + 1})")
                    continue
                raise GroqError("Request timeout")

            except httpx.HTTPStatusError as e:
                error_msg = f"HTTP error: {e.response.status_code}"
                try:
                    error_data = e.response.json()
                    error_msg = error_data.get("error", {}).get("message", error_msg)
                except json.JSONDecodeError:
                    pass
                raise GroqError(error_msg, status_code=e.response.status_code)

            except httpx.RequestError as e:
                raise GroqError(f"Request failed: {str(e)}")

        raise GroqError("Max retries exceeded")

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
            GroqError: If API call or JSON parsing fails
        """
        response = await self.complete(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=max_tokens,
            temperature=0.3,  # Lower temperature for structured output
        )

        content = response.content.strip()

        # Try to extract JSON from response
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            # Try to find JSON in the response
            import re

            # Look for JSON array
            array_match = re.search(r"\[.*\]", content, re.DOTALL)
            if array_match:
                try:
                    return json.loads(array_match.group())
                except json.JSONDecodeError:
                    pass

            # Look for JSON object
            obj_match = re.search(r"\{.*\}", content, re.DOTALL)
            if obj_match:
                try:
                    return json.loads(obj_match.group())
                except json.JSONDecodeError:
                    pass

            raise GroqError(f"Failed to parse JSON from response: {content[:200]}")
