"""LLM integration module."""

from .groq_client import GroqClient, GroqResponse
from .prompts import (
    BIO_GENERATION_PROMPT,
    TAGS_GENERATION_PROMPT,
    CONTACT_TAGS_PROMPT,
)

__all__ = [
    "GroqClient",
    "GroqResponse",
    "BIO_GENERATION_PROMPT",
    "TAGS_GENERATION_PROMPT",
    "CONTACT_TAGS_PROMPT",
]
