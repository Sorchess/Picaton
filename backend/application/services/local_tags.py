"""Local LLM-based tags generator."""

import logging

from infrastructure.llm.local_llm_client import LocalLLMClient, LocalLLMError
from infrastructure.llm.prompts import TAGS_GENERATION_PROMPT, CONTACT_TAGS_PROMPT
from .ai_tags import AITagsGeneratorInterface, GeneratedTags, SuggestedTag

logger = logging.getLogger(__name__)


class LocalTagsGenerator(AITagsGeneratorInterface):
    """
    Tags generator using local T-lite model via llama.cpp.

    Extracts professional skills and technologies from user bio.
    Falls back to rule-based extraction if local LLM fails.
    """

    def __init__(self):
        self._client = LocalLLMClient()

    async def generate_tags_from_bio(self, bio: str) -> GeneratedTags:
        """
        Generate tags from user bio using local LLM.

        Args:
            bio: User's bio description

        Returns:
            GeneratedTags with extracted tags and skills
        """
        if not bio or not bio.strip():
            return GeneratedTags(suggested_tags=[], tags=[], skills=[])

        try:
            # Use complete_json for structured output
            tags_list = await self._client.complete_json(
                system_prompt=TAGS_GENERATION_PROMPT,
                user_prompt=bio,
                max_tokens=200,
            )

            # Handle response format
            if isinstance(tags_list, dict):
                # If model returns {"tags": [...]} format
                tags_list = tags_list.get("tags", tags_list.get("result", []))

            if not isinstance(tags_list, list):
                logger.warning(f"Unexpected tags format: {type(tags_list)}")
                return await self._fallback_generate(bio)

            # Convert to SuggestedTag format
            suggested_tags = []
            for i, tag in enumerate(tags_list[:15]):
                if isinstance(tag, str):
                    suggested_tags.append(
                        SuggestedTag(
                            name=tag,
                            category=self._detect_category(tag),
                            confidence=0.9 - (i * 0.05),  # Decreasing confidence
                            reason="Извлечено AI из описания",
                        )
                    )
                elif isinstance(tag, dict):
                    suggested_tags.append(
                        SuggestedTag(
                            name=tag.get("name", str(tag)),
                            category=tag.get("category", "Общее"),
                            confidence=tag.get("confidence", 0.8),
                            reason=tag.get("reason", "Извлечено AI"),
                        )
                    )

            # For backward compatibility
            tags = [t.name.lower() for t in suggested_tags[:10]]
            skills = [
                {
                    "name": t.name,
                    "category": t.category,
                    "proficiency": min(5, int(t.confidence * 5) + 1),
                }
                for t in suggested_tags[:8]
            ]

            return GeneratedTags(
                suggested_tags=suggested_tags,
                tags=tags,
                skills=skills,
            )

        except LocalLLMError as e:
            logger.warning(f"Local LLM error in generate_tags: {e.message}")
            return await self._fallback_generate(bio)

    async def generate_tags_from_notes(self, notes: str) -> list[str]:
        """
        Generate tags from contact notes.

        Args:
            notes: Notes about a contact

        Returns:
            List of extracted tags
        """
        if not notes or not notes.strip():
            return []

        try:
            tags_list = await self._client.complete_json(
                system_prompt=CONTACT_TAGS_PROMPT,
                user_prompt=notes,
                max_tokens=100,
            )

            if isinstance(tags_list, dict):
                tags_list = tags_list.get("tags", [])

            if isinstance(tags_list, list):
                return [str(t) for t in tags_list[:7] if t]

            return []

        except LocalLLMError as e:
            logger.warning(f"Local LLM error in generate_tags_from_notes: {e.message}")
            return []

    async def generate_tags_from_facts(self, facts: list[str]) -> GeneratedTags:
        """
        Generate tags from list of facts.

        Args:
            facts: List of facts about user

        Returns:
            GeneratedTags with extracted tags
        """
        if not facts:
            return GeneratedTags(suggested_tags=[], tags=[], skills=[])

        combined = "; ".join(facts)
        return await self.generate_tags_from_bio(combined)

    async def _fallback_generate(self, bio: str) -> GeneratedTags:
        """
        Fallback tag generation using rule-based extraction.
        Used when LLM fails.
        """
        bio_lower = bio.lower()

        # Simple keyword mapping for fallback
        keywords = {
            "python": ("Python", "Языки"),
            "javascript": ("JavaScript", "Языки"),
            "typescript": ("TypeScript", "Языки"),
            "react": ("React", "Frontend"),
            "vue": ("Vue.js", "Frontend"),
            "angular": ("Angular", "Frontend"),
            "node": ("Node.js", "Backend"),
            "django": ("Django", "Backend"),
            "fastapi": ("FastAPI", "Backend"),
            "flask": ("Flask", "Backend"),
            "sql": ("SQL", "Базы данных"),
            "postgresql": ("PostgreSQL", "Базы данных"),
            "mongodb": ("MongoDB", "Базы данных"),
            "docker": ("Docker", "DevOps"),
            "kubernetes": ("Kubernetes", "DevOps"),
            "aws": ("AWS", "Cloud"),
            "figma": ("Figma", "Дизайн"),
            "верстк": ("HTML/CSS", "Frontend"),
            "дизайн": ("UI/UX Design", "Дизайн"),
            "design": ("Design", "Дизайн"),
            "менеджер": ("Менеджмент", "Менеджмент"),
            "product": ("Product Management", "Менеджмент"),
            "аналитик": ("Аналитика", "Аналитика"),
            "ml": ("Machine Learning", "AI/ML"),
            "machine learning": ("Machine Learning", "AI/ML"),
            "data science": ("Data Science", "AI/ML"),
        }

        suggested_tags = []
        seen = set()

        for keyword, (name, category) in keywords.items():
            if keyword in bio_lower and name not in seen:
                seen.add(name)
                suggested_tags.append(
                    SuggestedTag(
                        name=name,
                        category=category,
                        confidence=0.7,
                        reason=f"Найдено в тексте: «{keyword}»",
                    )
                )

        tags = [t.name.lower() for t in suggested_tags[:10]]
        skills = [
            {"name": t.name, "category": t.category, "proficiency": 3}
            for t in suggested_tags[:8]
        ]

        return GeneratedTags(
            suggested_tags=suggested_tags,
            tags=tags,
            skills=skills,
        )

    def _detect_category(self, tag: str) -> str:
        """Detect category for a tag based on common patterns."""
        tag_lower = tag.lower()

        # Language keywords
        languages = ["python", "javascript", "typescript", "java", "go", "rust", "php", "swift", "kotlin", "c++", "c#"]
        if any(lang in tag_lower for lang in languages):
            return "Языки"

        # Frontend keywords
        frontend = ["react", "vue", "angular", "html", "css", "frontend", "ui"]
        if any(kw in tag_lower for kw in frontend):
            return "Frontend"

        # Backend keywords
        backend = ["backend", "api", "server", "django", "fastapi", "flask", "node", "express", "spring"]
        if any(kw in tag_lower for kw in backend):
            return "Backend"

        # Database keywords
        databases = ["sql", "postgres", "mysql", "mongodb", "redis", "database"]
        if any(kw in tag_lower for kw in databases):
            return "Базы данных"

        # DevOps keywords
        devops = ["docker", "kubernetes", "k8s", "ci", "cd", "jenkins", "devops"]
        if any(kw in tag_lower for kw in devops):
            return "DevOps"

        # Cloud keywords
        cloud = ["aws", "azure", "gcp", "cloud"]
        if any(kw in tag_lower for kw in cloud):
            return "Cloud"

        # AI/ML keywords
        aiml = ["ml", "ai", "machine", "deep", "neural", "tensorflow", "pytorch", "data science"]
        if any(kw in tag_lower for kw in aiml):
            return "AI/ML"

        # Design keywords
        design = ["design", "дизайн", "figma", "photoshop", "ui", "ux"]
        if any(kw in tag_lower for kw in design):
            return "Дизайн"

        return "Общее"
