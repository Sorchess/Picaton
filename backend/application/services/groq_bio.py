"""Groq-based bio generator service."""

import logging

from domain.entities.user import User
from infrastructure.llm.groq_client import GroqClient, GroqError
from infrastructure.llm.prompts import BIO_GENERATION_PROMPT
from .ai_bio import AIBioGeneratorInterface, GeneratedBio

logger = logging.getLogger(__name__)


class GroqBioGenerator(AIBioGeneratorInterface):
    """
    LLM-based bio generator using Groq API.

    Generates professional self-presentation from user data.
    Falls back to simple template if API fails.
    """

    def __init__(self):
        self._client = GroqClient()

    async def generate_bio(self, user: User) -> GeneratedBio:
        """
        Generate professional bio using Groq LLM.

        Args:
            user: User entity with bio and random facts

        Returns:
            GeneratedBio with generated presentation
        """
        bio_text = user.bio or ""
        name = user.first_name or ""
        if not name and user.full_name:
            name = user.full_name.split()[0]

        # If no bio, try to use random facts
        if not bio_text.strip():
            if user.random_facts:
                return await self.generate_from_facts(user.random_facts, name)
            return GeneratedBio(
                bio=self._default_bio(name),
                tokens_used=0,
            )

        return await self._generate(bio_text, name)

    async def generate_from_facts(self, facts: list[str], name: str) -> GeneratedBio:
        """
        Generate bio from list of random facts.

        Args:
            facts: List of facts about the user
            name: User's first name

        Returns:
            GeneratedBio with generated presentation
        """
        if not facts:
            return GeneratedBio(
                bio=self._default_bio(name),
                tokens_used=0,
            )

        facts_text = "; ".join(facts)
        return await self._generate(facts_text, name)

    async def _generate(self, text: str, name: str) -> GeneratedBio:
        """Internal method to generate bio using LLM."""
        user_prompt = (
            f"Имя: {name}\nИнформация: {text}" if name else f"Информация: {text}"
        )

        try:
            response = await self._client.complete(
                system_prompt=BIO_GENERATION_PROMPT,
                user_prompt=user_prompt,
                max_tokens=200,
                temperature=0.7,
            )

            bio = self._clean_bio(response.content)

            return GeneratedBio(
                bio=bio,
                tokens_used=response.tokens_used,
            )

        except GroqError as e:
            logger.warning(f"Groq API error in generate_bio: {e.message}")
            return GeneratedBio(
                bio=self._fallback_bio(text, name),
                tokens_used=0,
            )

    def _clean_bio(self, bio: str) -> str:
        """Clean generated bio text."""
        bio = bio.strip()

        # Remove quotes if wrapped
        if bio.startswith('"') and bio.endswith('"'):
            bio = bio[1:-1]
        if bio.startswith("'") and bio.endswith("'"):
            bio = bio[1:-1]

        # Remove common prefixes
        prefixes_to_remove = [
            "Вот самопрезентация:",
            "Самопрезентация:",
            "Презентация:",
            "Описание:",
        ]
        for prefix in prefixes_to_remove:
            if bio.lower().startswith(prefix.lower()):
                bio = bio[len(prefix) :].strip()

        return bio

    def _default_bio(self, name: str) -> str:
        """Generate default bio when no data available."""
        if name:
            return f"{name} — профессионал, открытый к новым проектам и сотрудничеству."
        return "Профессионал, открытый к новым проектам и сотрудничеству."

    def _fallback_bio(self, text: str, name: str) -> str:
        """Fallback bio generation when API fails."""
        text_lower = text.lower()

        # Detect role with specialization
        role = "специалист"
        specialization = ""

        # Check for specific activities first
        if any(word in text_lower for word in ["верстк", "вёрстк"]):
            role = "веб-разработчик"
            specialization = "вёрстке и стилизации сайтов"
        elif any(word in text_lower for word in ["стилизац"]):
            role = "веб-разработчик"
            specialization = "стилизации веб-интерфейсов"
        elif any(word in text_lower for word in ["frontend", "фронтенд"]):
            role = "frontend-разработчик"
            specialization = "создании пользовательских интерфейсов"
        elif any(word in text_lower for word in ["backend", "бэкенд", "бекенд"]):
            role = "backend-разработчик"
            specialization = "серверной разработке"
        elif any(word in text_lower for word in ["fullstack", "фулстек"]):
            role = "fullstack-разработчик"
        elif any(word in text_lower for word in ["разработ", "програм", "developer"]):
            role = "разработчик"
        elif any(word in text_lower for word in ["дизайн", "design"]):
            role = "дизайнер"
        elif any(word in text_lower for word in ["менеджер", "manager", "руковод"]):
            role = "менеджер"
        elif any(word in text_lower for word in ["аналитик", "analyst"]):
            role = "аналитик"

        # Build bio with extracted info
        if name and specialization:
            return f"{name} — {role}, специализирующийся на {specialization}. Открыт к интересным проектам."
        elif name:
            return f"{name} — опытный {role}, открытый к интересным проектам."
        elif specialization:
            return f"Опытный {role}, специализирующийся на {specialization}."
        return f"Опытный {role}, открытый к интересным проектам."
