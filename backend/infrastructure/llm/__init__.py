"""LLM integration module."""

from .gigachat_client import GigaChatClient, GigaChatResponse
from .prompts import (
    BIO_GENERATION_PROMPT,
    TAGS_GENERATION_PROMPT,
    CONTACT_TAGS_PROMPT,
)

__all__ = [
    "GigaChatClient",
    "GigaChatResponse",
    "BIO_GENERATION_PROMPT",
    "TAGS_GENERATION_PROMPT",
    "CONTACT_TAGS_PROMPT",
]
