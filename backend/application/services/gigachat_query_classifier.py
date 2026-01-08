"""
Сервис классификации поисковых запросов через GigaChat.
Определяет тип запроса: задача (task) или навык (skill).
"""

import logging
from enum import Enum

from infrastructure.llm.gigachat_client import GigaChatClient, GigaChatError

logger = logging.getLogger(__name__)


class QueryType(str, Enum):
    """Тип поискового запроса."""

    TASK = "task"  # "Нужно создать сайт", "Автоматизировать процессы"
    SKILL = "skill"  # "python", "react разработчик"


# Промпт для классификации запроса
CLASSIFICATION_PROMPT = """Определи тип поискового запроса для поиска специалистов.

TASK - если запрос описывает задачу, проблему, проект, действие (глаголы "создать", "разработать", "сделать", "автоматизировать", "настроить", "исправить", "оптимизировать" и т.д.)
Примеры TASK: "создать сайт", "нужно разработать мобильное приложение", "автоматизировать процессы", "сделать лендинг", "настроить CI/CD"

SKILL - если запрос это технология, навык, профессия, инструмент или просто ключевые слова для поиска
Примеры SKILL: "python", "react", "дизайнер", "react разработчик", "frontend", "devops инженер", "машинное обучение"

Отвечай ТОЛЬКО одним словом: TASK или SKILL

Запрос: "{query}"
"""


class GigaChatQueryClassifier:
    """
    Классификатор типа поискового запроса.

    Использует GigaChat LLM для определения является ли запрос:
    - TASK: задачей/проблемой которую нужно решить
    - SKILL: навыком/технологией для поиска специалиста
    """

    # Кеш для частых запросов
    _cache: dict[str, QueryType] = {}
    _cache_max_size: int = 200

    def __init__(self, gigachat_client: GigaChatClient):
        self._gigachat = gigachat_client

    async def classify_query(self, query: str) -> QueryType:
        """
        Определить тип поискового запроса.

        Args:
            query: Поисковый запрос пользователя

        Returns:
            QueryType.TASK если это задача
            QueryType.SKILL если это навык/технология

        Примеры:
            "Нужно создать сайт" → TASK
            "Автоматизировать процессы" → TASK
            "python" → SKILL
            "react разработчик" → SKILL
        """
        query_lower = query.lower().strip()

        # Проверяем кеш
        if query_lower in self._cache:
            logger.debug(f"Query classification cache hit: '{query}' → {self._cache[query_lower]}")
            return self._cache[query_lower]

        # Быстрая эвристика для очевидных случаев
        quick_result = self._quick_classify(query_lower)
        if quick_result is not None:
            self._add_to_cache(query_lower, quick_result)
            return quick_result

        # Если GigaChat не сконфигурирован, используем эвристику
        if not self._gigachat.is_configured:
            result = self._fallback_classify(query_lower)
            logger.warning(f"GigaChat not configured, using fallback: '{query}' → {result}")
            return result

        try:
            response = await self._gigachat.complete(
                system_prompt=CLASSIFICATION_PROMPT.format(query=query),
                user_prompt=query,
                max_tokens=10,
                temperature=0.1,  # Низкая температура для консистентности
            )

            result = self._parse_response(response.content, query_lower)
            self._add_to_cache(query_lower, result)

            logger.info(f"Query classified: '{query}' → {result}")
            return result

        except GigaChatError as e:
            logger.warning(f"GigaChat error during classification: {e}, using fallback")
            return self._fallback_classify(query_lower)
        except Exception as e:
            logger.error(f"Unexpected error during classification: {e}")
            return self._fallback_classify(query_lower)

    def _quick_classify(self, query: str) -> QueryType | None:
        """
        Быстрая классификация для очевидных случаев.

        Returns:
            QueryType если можно определить без LLM, иначе None
        """
        # Короткие запросы (1-2 слова без глаголов) - скорее всего SKILL
        words = query.split()
        if len(words) <= 2:
            # Проверяем нет ли глаголов действия
            task_verbs = {
                "создать", "сделать", "разработать", "написать", "настроить",
                "автоматизировать", "оптимизировать", "исправить", "починить",
                "нужно", "надо", "требуется", "необходимо", "хочу", "помогите",
            }
            if not any(verb in query for verb in task_verbs):
                return QueryType.SKILL

        # Явные маркеры задачи
        task_markers = [
            "нужно", "надо", "требуется", "необходимо", "хочу", "помогите",
            "создать", "сделать", "разработать", "написать", "настроить",
            "автоматизировать", "оптимизировать", "исправить", "починить",
            "построить", "внедрить", "запустить", "развернуть", "интегрировать",
        ]
        if any(marker in query for marker in task_markers):
            return QueryType.TASK

        return None

    def _fallback_classify(self, query: str) -> QueryType:
        """
        Fallback классификация на основе эвристики.

        Используется когда GigaChat недоступен.
        """
        # Проверяем наличие глаголов действия
        task_indicators = [
            "создать", "сделать", "разработать", "написать", "настроить",
            "автоматизировать", "оптимизировать", "исправить", "починить",
            "нужно", "надо", "требуется", "необходимо", "хочу", "помогите",
            "построить", "внедрить", "запустить", "развернуть", "интегрировать",
            "сайт", "приложение", "систему", "бота", "api", "базу данных",
        ]

        # Если много слов и есть глаголы - это задача
        words = query.split()
        if len(words) >= 3 and any(ind in query for ind in task_indicators):
            return QueryType.TASK

        # По умолчанию - это навык/технология
        return QueryType.SKILL

    def _parse_response(self, content: str, original_query: str) -> QueryType:
        """Парсить ответ LLM."""
        content = content.strip().upper()

        if "TASK" in content:
            return QueryType.TASK
        if "SKILL" in content:
            return QueryType.SKILL

        # Если не удалось распарсить - используем fallback
        logger.warning(f"Failed to parse classification response: {content}")
        return self._fallback_classify(original_query)

    def _add_to_cache(self, query: str, query_type: QueryType) -> None:
        """Добавить результат в кеш."""
        if len(self._cache) >= self._cache_max_size:
            # Очищаем половину кеша
            keys_to_remove = list(self._cache.keys())[: self._cache_max_size // 2]
            for key in keys_to_remove:
                del self._cache[key]

        self._cache[query] = query_type

    def clear_cache(self) -> None:
        """Очистить кеш."""
        self._cache.clear()
