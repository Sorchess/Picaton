"""Async client for GigaChat API от Сбера."""

import json
import logging
import re
from dataclasses import dataclass

from gigachat import GigaChat
from gigachat.models import Chat, Messages, MessagesRole
from gigachat.exceptions import (
    GigaChatException,
    AuthenticationError,
    RateLimitError,
    ServerError,
)

from settings.config import settings

logger = logging.getLogger(__name__)


@dataclass
class GigaChatResponse:
    """Response from GigaChat API."""

    content: str
    tokens_used: int
    model: str


class GigaChatError(Exception):
    """GigaChat API error."""

    def __init__(self, message: str, status_code: int | None = None):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class GigaChatClient:
    """
    Async client for GigaChat API.

    Использует официальный SDK от Сбера с OAuth2 авторизацией.
    Токен автоматически обновляется каждые 30 минут.
    """

    MAX_RETRIES = 2

    def __init__(self):
        self._credentials = settings.gigachat.credentials
        self._scope = settings.gigachat.scope
        self._model = settings.gigachat.model
        self._default_max_tokens = settings.gigachat.max_tokens
        self._default_temperature = settings.gigachat.temperature
        self._verify_ssl = settings.gigachat.verify_ssl_certs

    @property
    def is_configured(self) -> bool:
        """Check if GigaChat API is configured."""
        return bool(self._credentials)

    def _get_client(self) -> GigaChat:
        """Create GigaChat client instance."""
        return GigaChat(
            credentials=self._credentials,
            scope=self._scope,
            model=self._model,
            verify_ssl_certs=self._verify_ssl,
        )

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> GigaChatResponse:
        """
        Generate completion using GigaChat API.

        Args:
            system_prompt: System message for the model
            user_prompt: User message to complete
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0-2)

        Returns:
            GigaChatResponse with generated content

        Raises:
            GigaChatError: If API call fails
        """
        if not self.is_configured:
            raise GigaChatError("GigaChat credentials not configured")

        max_tokens = max_tokens or self._default_max_tokens
        temperature = (
            temperature if temperature is not None else self._default_temperature
        )

        payload = Chat(
            messages=[
                Messages(role=MessagesRole.SYSTEM, content=system_prompt),
                Messages(role=MessagesRole.USER, content=user_prompt),
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )

        for attempt in range(self.MAX_RETRIES + 1):
            try:
                async with GigaChat(
                    credentials=self._credentials,
                    scope=self._scope,
                    model=self._model,
                    verify_ssl_certs=self._verify_ssl,
                ) as client:
                    response = await client.achat(payload)

                    return GigaChatResponse(
                        content=response.choices[0].message.content,
                        tokens_used=response.usage.total_tokens if response.usage else 0,
                        model=response.model or self._model,
                    )

            except RateLimitError as e:
                logger.warning(f"GigaChat rate limit exceeded: {e}")
                raise GigaChatError("Rate limit exceeded", status_code=429)

            except AuthenticationError as e:
                logger.error(f"GigaChat authentication error: {e}")
                raise GigaChatError("Authentication failed", status_code=401)

            except ServerError as e:
                if attempt < self.MAX_RETRIES:
                    logger.warning(
                        f"GigaChat server error, retrying (attempt {attempt + 1}): {e}"
                    )
                    continue
                raise GigaChatError(f"Server error: {e}", status_code=500)

            except GigaChatException as e:
                logger.error(f"GigaChat API error: {e}")
                raise GigaChatError(f"API error: {e}")

            except Exception as e:
                logger.error(f"Unexpected error in GigaChat: {e}")
                raise GigaChatError(f"Unexpected error: {e}")

        raise GigaChatError("Max retries exceeded")

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
            GigaChatError: If API call or JSON parsing fails
        """
        response = await self.complete(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=max_tokens,
            temperature=0.3,  # Lower temperature for structured output
        )

        content = response.content.strip()

        # Remove markdown code blocks if present
        if content.startswith("```"):
            lines = content.split("\n")
            # Remove first line (```json) and last line (```)
            if lines[-1].strip() == "```":
                content = "\n".join(lines[1:-1])
            else:
                content = "\n".join(lines[1:])
            content = content.strip()

        # Try to parse JSON directly
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            # Try to find JSON in the response
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

            raise GigaChatError(f"Failed to parse JSON from response: {content[:200]}")
