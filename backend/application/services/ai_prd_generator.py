"""AI-сервис для генерации PRD из голоса/текста (Фабрика Идей)."""

import json
import logging
from dataclasses import dataclass

from infrastructure.llm.gigachat_client import GigaChatClient


logger = logging.getLogger(__name__)


# Промпт для генерации PRD
PRD_GENERATION_PROMPT = """Ты - эксперт по продуктовому менеджменту и структурированию идей.
Твоя задача - преобразовать краткое описание идеи в структурированный PRD (Product Requirements Document).

Правила:
1. Верни ТОЛЬКО JSON объект без комментариев
2. Все поля на русском языке
3. Если информации недостаточно, сделай разумные предположения
4. Навыки (required_skills) должны быть конкретными и актуальными
5. Структура ответа:

{
  "title": "Краткое название идеи (до 100 символов)",
  "problem_statement": "Описание проблемы, которую решает идея (2-3 предложения)",
  "solution_description": "Описание решения (3-5 предложений)",
  "target_users": "Кто целевая аудитория? (1-2 предложения)",
  "mvp_scope": "Минимальный функционал для первой версии (3-5 пунктов)",
  "success_metrics": "Как измерить успех? (2-3 метрики)",
  "risks": "Основные риски и ограничения (2-3 пункта)",
  "timeline": "Примерные сроки реализации",
  "required_skills": ["навык1", "навык2", ...],
  "roles": ["Роль1", "Роль2", ...]
}
"""

# Промпт для извлечения тегов/навыков
SKILLS_EXTRACTION_PROMPT = """Ты - эксперт по анализу проектов и подбору команд.
Проанализируй описание идеи и извлеки необходимые навыки и роли.

Правила:
1. Верни ТОЛЬКО JSON объект
2. Навыки (skills) - конкретные технические и софт-скиллы (5-15 штук)
3. Роли (roles) - названия профессий/должностей (3-7 штук)
4. Priority - 3 самых критичных навыка
5. Confidence - уверенность в точности (0.0 - 1.0)

{
  "skills": ["python", "машинное обучение", "api разработка", ...],
  "roles": ["Backend разработчик", "ML Engineer", "Product Manager"],
  "priority": ["python", "ml", "api"],
  "confidence": 0.85
}
"""


@dataclass
class GeneratedPRD:
    """Результат генерации PRD."""

    title: str
    problem_statement: str
    solution_description: str
    target_users: str
    mvp_scope: str
    success_metrics: str
    risks: str
    timeline: str
    required_skills: list[str]
    roles: list[str]
    confidence: float = 0.8


@dataclass
class ExtractedSkills:
    """Извлечённые навыки."""

    skills: list[str]
    roles: list[str]
    priority_skills: list[str]
    confidence: float


class AIPRDGeneratorService:
    """
    AI-сервис для генерации PRD.
    Принимает голосовую транскрипцию или текстовое описание,
    генерирует структурированный PRD.
    """

    def __init__(self, gigachat_client: GigaChatClient):
        self._gigachat = gigachat_client

    async def generate_prd(
        self,
        raw_input: str,
        input_type: str = "text",  # "text" | "voice_transcript"
        context: str | None = None,
    ) -> GeneratedPRD:
        """
        Сгенерировать PRD из текста или голосовой транскрипции.

        Args:
            raw_input: Исходный текст или транскрипция
            input_type: Тип ввода
            context: Дополнительный контекст (напр. информация о компании)

        Returns:
            GeneratedPRD с заполненными полями
        """
        if not self._gigachat.is_configured:
            return self._fallback_prd(raw_input)

        # Формируем промпт
        user_prompt = f"""Тип ввода: {input_type}

Исходное описание идеи:
{raw_input}
"""

        if context:
            user_prompt += f"\n\nДополнительный контекст:\n{context}"

        try:
            response = await self._gigachat.complete(
                system_prompt=PRD_GENERATION_PROMPT,
                user_prompt=user_prompt,
                max_tokens=1500,
                temperature=0.4,
            )

            # Парсим JSON
            data = self._parse_json_response(response)

            return GeneratedPRD(
                title=data.get("title", self._extract_title(raw_input)),
                problem_statement=data.get("problem_statement", ""),
                solution_description=data.get("solution_description", ""),
                target_users=data.get("target_users", ""),
                mvp_scope=data.get("mvp_scope", ""),
                success_metrics=data.get("success_metrics", ""),
                risks=data.get("risks", ""),
                timeline=data.get("timeline", ""),
                required_skills=data.get("required_skills", []),
                roles=data.get("roles", []),
                confidence=0.85,
            )

        except Exception as e:
            logger.warning(f"Failed to generate PRD with AI: {e}")
            return self._fallback_prd(raw_input)

    async def extract_skills(
        self,
        text: str,
        existing_skills: list[str] | None = None,
    ) -> ExtractedSkills:
        """
        Извлечь навыки из текста.

        Args:
            text: Текст для анализа
            existing_skills: Уже указанные навыки (для уточнения)

        Returns:
            ExtractedSkills с навыками и уверенностью
        """
        if not self._gigachat.is_configured:
            return ExtractedSkills(
                skills=existing_skills or [],
                roles=[],
                priority_skills=(existing_skills or [])[:3],
                confidence=0.5,
            )

        user_prompt = f"Описание идеи:\n{text}"

        if existing_skills:
            user_prompt += f"\n\nУже указанные навыки: {', '.join(existing_skills)}"

        try:
            response = await self._gigachat.complete(
                system_prompt=SKILLS_EXTRACTION_PROMPT,
                user_prompt=user_prompt,
                max_tokens=500,
                temperature=0.3,
            )

            data = self._parse_json_response(response)

            return ExtractedSkills(
                skills=data.get("skills", existing_skills or []),
                roles=data.get("roles", []),
                priority_skills=data.get("priority", [])[:3],
                confidence=data.get("confidence", 0.8),
            )

        except Exception as e:
            logger.warning(f"Failed to extract skills: {e}")
            return ExtractedSkills(
                skills=existing_skills or [],
                roles=[],
                priority_skills=(existing_skills or [])[:3],
                confidence=0.5,
            )

    async def improve_prd(
        self,
        current_prd: dict,
        feedback: str,
    ) -> GeneratedPRD:
        """
        Улучшить PRD на основе фидбека.

        Args:
            current_prd: Текущий PRD как dict
            feedback: Пожелания по улучшению

        Returns:
            Улучшенный PRD
        """
        if not self._gigachat.is_configured:
            return GeneratedPRD(**current_prd, confidence=0.5)

        user_prompt = f"""Текущий PRD:
{json.dumps(current_prd, ensure_ascii=False, indent=2)}

Пожелания по улучшению:
{feedback}

Улучши PRD с учётом пожеланий и верни обновлённый JSON."""

        try:
            response = await self._gigachat.complete(
                system_prompt=PRD_GENERATION_PROMPT,
                user_prompt=user_prompt,
                max_tokens=1500,
                temperature=0.4,
            )

            data = self._parse_json_response(response)

            return GeneratedPRD(
                title=data.get("title", current_prd.get("title", "")),
                problem_statement=data.get(
                    "problem_statement", current_prd.get("problem_statement", "")
                ),
                solution_description=data.get(
                    "solution_description", current_prd.get("solution_description", "")
                ),
                target_users=data.get(
                    "target_users", current_prd.get("target_users", "")
                ),
                mvp_scope=data.get("mvp_scope", current_prd.get("mvp_scope", "")),
                success_metrics=data.get(
                    "success_metrics", current_prd.get("success_metrics", "")
                ),
                risks=data.get("risks", current_prd.get("risks", "")),
                timeline=data.get("timeline", current_prd.get("timeline", "")),
                required_skills=data.get(
                    "required_skills", current_prd.get("required_skills", [])
                ),
                roles=data.get("roles", current_prd.get("roles", [])),
                confidence=0.9,
            )

        except Exception as e:
            logger.warning(f"Failed to improve PRD: {e}")
            return GeneratedPRD(**current_prd, confidence=0.5)

    def _parse_json_response(self, response: str) -> dict:
        """Парсинг JSON из ответа LLM."""
        # Убираем markdown блоки если есть
        text = response.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        return json.loads(text.strip())

    def _fallback_prd(self, raw_input: str) -> GeneratedPRD:
        """Fallback PRD без AI."""
        return GeneratedPRD(
            title=self._extract_title(raw_input),
            problem_statement="",
            solution_description=raw_input,
            target_users="",
            mvp_scope="",
            success_metrics="",
            risks="",
            timeline="",
            required_skills=[],
            roles=[],
            confidence=0.0,
        )

    def _extract_title(self, text: str) -> str:
        """Извлечь заголовок из текста."""
        # Берём первое предложение или первые 100 символов
        sentences = text.split(".")
        if sentences:
            title = sentences[0].strip()
            if len(title) > 100:
                title = title[:97] + "..."
            return title
        return text[:100] if len(text) > 100 else text
