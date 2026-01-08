"""GigaChat-based tag generator service."""

import logging
import re

from infrastructure.llm.gigachat_client import GigaChatClient, GigaChatError
from infrastructure.llm.prompts import (
    TAGS_GENERATION_PROMPT,
    CONTACT_TAGS_PROMPT,
    TAGS_FROM_FACTS_PROMPT,
)
from .ai_tags import AITagsGeneratorInterface, GeneratedTags, SuggestedTag

logger = logging.getLogger(__name__)


class GigaChatTagsGenerator(AITagsGeneratorInterface):
    """
    LLM-based tag generator using GigaChat API.

    Generates professional tags from bio text or contact notes.
    Falls back to simple extraction if API fails.
    """

    def __init__(self):
        self._client = GigaChatClient()

    async def generate_tags_from_bio(self, bio: str) -> GeneratedTags:
        """
        Generate tags from user bio using GigaChat LLM.

        Args:
            bio: User's bio text

        Returns:
            GeneratedTags with suggested tags
        """
        if not bio or not bio.strip():
            return GeneratedTags(suggested_tags=[], tags=[], skills=[])

        try:
            tags = await self._client.complete_json(
                system_prompt=TAGS_GENERATION_PROMPT,
                user_prompt=bio,
                max_tokens=200,
            )

            if not isinstance(tags, list):
                tags = []

            # Clean and deduplicate
            tags = self._clean_tags(tags)

            suggested = [
                SuggestedTag(
                    name=tag,
                    category="AI",
                    confidence=0.85,
                    reason="Сгенерировано AI на основе bio",
                )
                for tag in tags[:10]
            ]

            return GeneratedTags(
                suggested_tags=suggested,
                tags=[t.name.lower() for t in suggested],
                skills=[
                    {"name": t.name, "category": t.category, "proficiency": 4}
                    for t in suggested
                ],
            )

        except GigaChatError as e:
            logger.warning(f"GigaChat API error in generate_tags_from_bio: {e.message}")
            return self._fallback_extract_tags(bio)

    async def generate_tags_from_notes(self, notes: str) -> list[str]:
        """
        Generate search tags from contact notes.

        Args:
            notes: Notes about a contact

        Returns:
            List of tag strings for search
        """
        if not notes or not notes.strip():
            return []

        try:
            tags = await self._client.complete_json(
                system_prompt=CONTACT_TAGS_PROMPT,
                user_prompt=notes,
                max_tokens=150,
            )

            if not isinstance(tags, list):
                return []

            return self._clean_tags(tags)[:7]

        except GigaChatError as e:
            logger.warning(f"GigaChat API error in generate_tags_from_notes: {e.message}")
            return self._fallback_extract_from_notes(notes)

    async def generate_tags_from_facts(self, facts: list[str]) -> list[str]:
        """
        Generate tags from random facts about user.

        Args:
            facts: List of facts about the user

        Returns:
            List of tag strings
        """
        if not facts:
            return []

        facts_text = "; ".join(facts)

        try:
            tags = await self._client.complete_json(
                system_prompt=TAGS_FROM_FACTS_PROMPT,
                user_prompt=facts_text,
                max_tokens=150,
            )

            if not isinstance(tags, list):
                return []

            return self._clean_tags(tags)[:10]

        except GigaChatError as e:
            logger.warning(f"GigaChat API error in generate_tags_from_facts: {e.message}")
            return self._fallback_extract_tags_simple(facts_text)

    def _clean_tags(self, tags: list) -> list[str]:
        """Clean and deduplicate tags."""
        seen = set()
        result = []

        for tag in tags:
            if not isinstance(tag, str):
                continue

            tag = tag.strip()
            if not tag or len(tag) > 50:
                continue

            tag_lower = tag.lower()
            if tag_lower not in seen:
                seen.add(tag_lower)
                result.append(tag)

        return result

    def _fallback_extract_tags(self, bio: str) -> GeneratedTags:
        """Fallback tag extraction when API fails."""
        tags = self._fallback_extract_tags_simple(bio)

        suggested = [
            SuggestedTag(
                name=tag,
                category="Extracted",
                confidence=0.6,
                reason="Извлечено из текста",
            )
            for tag in tags[:10]
        ]

        return GeneratedTags(
            suggested_tags=suggested,
            tags=[t.name.lower() for t in suggested],
            skills=[
                {"name": t.name, "category": t.category, "proficiency": 3}
                for t in suggested
            ],
        )

    def _fallback_extract_tags_simple(self, text: str) -> list[str]:
        """Simple keyword extraction from text with implied technologies."""
        # Common tech keywords
        tech_keywords = {
            "python",
            "javascript",
            "typescript",
            "java",
            "go",
            "rust",
            "c++",
            "react",
            "vue",
            "angular",
            "node",
            "django",
            "fastapi",
            "flask",
            "docker",
            "kubernetes",
            "aws",
            "gcp",
            "azure",
            "postgresql",
            "mongodb",
            "redis",
            "mysql",
            "ml",
            "ai",
            "machine learning",
            "data science",
            "devops",
            "ci/cd",
            "backend",
            "frontend",
            "fullstack",
            "html",
            "css",
            "sass",
            "scss",
            "tailwind",
            "bootstrap",
        }

        # Implied technologies mapping
        implied_tech = {
            "верстк": ["HTML", "CSS", "верстка", "Frontend"],
            "вёрстк": ["HTML", "CSS", "верстка", "Frontend"],
            "стилизац": ["CSS", "стилизация"],
            "фронтенд": ["HTML", "CSS", "JavaScript", "Frontend"],
            "frontend": ["HTML", "CSS", "JavaScript", "Frontend"],
            "бэкенд": ["Backend", "API"],
            "бекенд": ["Backend", "API"],
            "backend": ["Backend", "API"],
            "fullstack": ["Frontend", "Backend", "Fullstack"],
            "фулстек": ["Frontend", "Backend", "Fullstack"],
            "мобильн": ["Mobile"],
            "ios": ["iOS", "Swift", "Mobile"],
            "android": ["Android", "Kotlin", "Mobile"],
            "веб-разраб": ["веб-разработка", "HTML", "CSS"],
            "веб разраб": ["веб-разработка", "HTML", "CSS"],
            "сайт": ["веб-разработка"],
        }

        text_lower = text.lower()
        found = []
        seen = set()

        # First, check for implied technologies
        for pattern, tags in implied_tech.items():
            if pattern in text_lower:
                for tag in tags:
                    tag_lower = tag.lower()
                    if tag_lower not in seen:
                        seen.add(tag_lower)
                        found.append(tag)

        # Then check for explicit tech keywords
        for keyword in tech_keywords:
            if keyword in text_lower and keyword not in seen:
                seen.add(keyword)
                found.append(
                    keyword.upper() if len(keyword) <= 3 else keyword.capitalize()
                )

        return found[:10]

    def _fallback_extract_from_notes(self, notes: str) -> list[str]:
        """Simple extraction from contact notes."""
        # Extract capitalized words and common patterns
        words = re.findall(r"\b[A-ZА-ЯЁ][a-zа-яё]+\b", notes)

        # Filter out common words
        stop_words = {"The", "Это", "Он", "Она", "Они", "Мы", "Вы"}
        filtered = [w for w in words if w not in stop_words and len(w) > 2]

        # Take unique values
        seen = set()
        result = []
        for word in filtered:
            if word.lower() not in seen:
                seen.add(word.lower())
                result.append(word)

        return result[:5]
