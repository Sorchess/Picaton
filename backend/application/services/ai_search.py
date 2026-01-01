"""
AI-сервис для интеллектуального расширения поисковых запросов.
Использует LLM для генерации связанных тегов и навыков.
"""

import json
import logging
from dataclasses import dataclass
from functools import lru_cache

from infrastructure.llm.groq_client import GroqClient, GroqError

logger = logging.getLogger(__name__)

# Промпт для расширения поискового запроса
SEARCH_EXPANSION_PROMPT = """Ты - эксперт по IT-навыкам и профессиям. Твоя задача - расширить поисковый запрос пользователя, добавив связанные навыки, технологии и профессии.

Правила:
1. Верни JSON массив строк с связанными терминами
2. Включи синонимы на русском и английском
3. Включи связанные технологии и инструменты
4. Включи названия профессий, которые используют эту технологию
5. Максимум 15 связанных терминов
6. Термины должны быть короткими (1-3 слова)
7. Отвечай ТОЛЬКО JSON массивом, без пояснений

Примеры:
Запрос: "flask"
Ответ: ["python", "бэкенд", "backend", "веб-разработка", "api", "rest", "python разработчик", "backend developer", "jinja2", "sqlalchemy", "веб-фреймворк"]

Запрос: "машинное обучение"
Ответ: ["machine learning", "ml", "data science", "python", "tensorflow", "pytorch", "нейросети", "deep learning", "аналитик данных", "data scientist", "sklearn", "pandas"]

Запрос: "react"
Ответ: ["javascript", "typescript", "фронтенд", "frontend", "redux", "next.js", "jsx", "hooks", "веб-разработка", "spa", "frontend developer", "ui"]
"""


@dataclass
class SearchExpansionResult:
    """Результат расширения поискового запроса."""

    original_query: str
    expanded_tags: list[str]
    from_cache: bool = False


class AISearchService:
    """
    Сервис для AI-расширения поисковых запросов.
    Использует LLM для генерации связанных тегов и навыков.
    """

    # Простой in-memory кеш для частых запросов
    _cache: dict[str, list[str]] = {}
    _cache_max_size: int = 500

    def __init__(self, groq_client: GroqClient):
        self._groq = groq_client

    async def expand_query(self, query: str) -> SearchExpansionResult:
        """
        Расширить поисковый запрос с помощью AI.

        Args:
            query: Исходный поисковый запрос

        Returns:
            SearchExpansionResult с расширенными тегами
        """
        query_lower = query.lower().strip()

        # Проверяем кеш
        if query_lower in self._cache:
            return SearchExpansionResult(
                original_query=query,
                expanded_tags=self._cache[query_lower],
                from_cache=True,
            )

        # Если Groq не сконфигурирован, возвращаем только оригинальный запрос
        if not self._groq.is_configured:
            return SearchExpansionResult(
                original_query=query,
                expanded_tags=[query_lower],
                from_cache=False,
            )

        try:
            response = await self._groq.complete(
                system_prompt=SEARCH_EXPANSION_PROMPT,
                user_prompt=f'Запрос: "{query}"',
                max_tokens=200,
                temperature=0.3,  # Низкая температура для консистентности
            )

            # Парсим JSON ответ
            expanded_tags = self._parse_response(response.content, query_lower)

            # Сохраняем в кеш
            self._add_to_cache(query_lower, expanded_tags)

            return SearchExpansionResult(
                original_query=query,
                expanded_tags=expanded_tags,
                from_cache=False,
            )

        except GroqError as e:
            logger.warning(f"Groq API error during query expansion: {e}")
            return SearchExpansionResult(
                original_query=query,
                expanded_tags=[query_lower],
                from_cache=False,
            )
        except Exception as e:
            logger.error(f"Unexpected error during query expansion: {e}")
            return SearchExpansionResult(
                original_query=query,
                expanded_tags=[query_lower],
                from_cache=False,
            )

    def _parse_response(self, content: str, original_query: str) -> list[str]:
        """Парсить ответ LLM в список тегов."""
        try:
            # Пытаемся найти JSON массив в ответе
            content = content.strip()

            # Если ответ обёрнут в markdown code block
            if content.startswith("```"):
                lines = content.split("\n")
                content = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
                content = content.strip()

            tags = json.loads(content)

            if not isinstance(tags, list):
                return [original_query]

            # Нормализуем и фильтруем теги
            result = [original_query]  # Всегда включаем оригинальный запрос
            for tag in tags:
                if isinstance(tag, str):
                    normalized = tag.lower().strip()
                    if (
                        normalized
                        and normalized not in result
                        and len(normalized) <= 50
                    ):
                        result.append(normalized)

            return result[:16]  # Ограничиваем количество тегов

        except json.JSONDecodeError:
            logger.warning(f"Failed to parse LLM response as JSON: {content[:100]}")
            return [original_query]

    def _add_to_cache(self, query: str, tags: list[str]) -> None:
        """Добавить результат в кеш."""
        # Простая стратегия: если кеш полон, очищаем половину
        if len(self._cache) >= self._cache_max_size:
            keys_to_remove = list(self._cache.keys())[: self._cache_max_size // 2]
            for key in keys_to_remove:
                del self._cache[key]

        self._cache[query] = tags

    def clear_cache(self) -> None:
        """Очистить кеш."""
        self._cache.clear()

    def get_cache_stats(self) -> dict:
        """Получить статистику кеша."""
        return {
            "size": len(self._cache),
            "max_size": self._cache_max_size,
        }
