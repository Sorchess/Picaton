"""
Сервис декомпозиции задач в список требуемых навыков через Groq.
Преобразует описание задачи в набор тегов для поиска специалистов.
"""

import json
import logging
import re

from infrastructure.llm.groq_client import GroqClient, GroqError

logger = logging.getLogger(__name__)


# Промпт для декомпозиции задачи в навыки
TASK_DECOMPOSITION_PROMPT = """Ты эксперт по подбору IT-специалистов. Проанализируй задачу и определи какие специалисты и навыки нужны для её выполнения.

Правила:
1. Верни JSON массив строк с навыками и технологиями
2. Используй русские и английские термины
3. Включи: профессии (веб-разработчик, дизайнер), технологии (python, react), инструменты (docker, figma)
4. Все теги в lowercase
5. Максимум 15 тегов, сортируй по важности (самые важные первые)
6. Отвечай ТОЛЬКО JSON массивом, без пояснений

Примеры:

Задача: "Нужно создать сайт"
Ответ: ["веб-разработчик", "frontend", "html", "css", "javascript", "react", "vue", "верстка", "дизайн", "адаптивная верстка"]

Задача: "Автоматизировать CI/CD процессы"
Ответ: ["devops", "ci/cd", "docker", "kubernetes", "jenkins", "gitlab", "github actions", "python", "bash", "автоматизация"]

Задача: "Разработать мобильное приложение для доставки еды"
Ответ: ["мобильная разработка", "react native", "flutter", "ios", "android", "swift", "kotlin", "ui/ux", "backend", "api"]

Задача: "Создать чат-бота для поддержки клиентов"
Ответ: ["python", "chatbot", "nlp", "машинное обучение", "telegram", "api", "backend", "диалоговые системы", "ai"]

Задача: "Настроить аналитику для интернет-магазина"
Ответ: ["аналитика", "google analytics", "data analyst", "sql", "python", "метрики", "bi", "tableau", "power bi", "e-commerce"]

Задача: "{task}"
"""


# Fallback маппинг для случаев когда Groq недоступен
TASK_KEYWORD_MAP = {
    # Веб-разработка
    "сайт": ["веб-разработчик", "frontend", "html", "css", "javascript", "react", "верстка", "дизайн"],
    "лендинг": ["веб-разработчик", "верстальщик", "html", "css", "javascript", "дизайн", "адаптивная верстка"],
    "интернет-магазин": ["веб-разработчик", "e-commerce", "backend", "frontend", "php", "wordpress", "1c"],
    "портал": ["веб-разработчик", "fullstack", "backend", "frontend", "база данных", "api"],

    # Мобильная разработка
    "приложение": ["мобильная разработка", "react native", "flutter", "ios", "android", "ui/ux"],
    "мобильн": ["мобильная разработка", "react native", "flutter", "ios", "android", "swift", "kotlin"],

    # Backend
    "api": ["backend", "python", "fastapi", "django", "rest", "api", "базы данных"],
    "сервер": ["backend", "devops", "linux", "nginx", "docker", "администрирование"],
    "бэкенд": ["backend", "python", "java", "node.js", "go", "базы данных", "api"],

    # DevOps
    "автоматизир": ["devops", "python", "ci/cd", "docker", "kubernetes", "автоматизация", "bash"],
    "ci/cd": ["devops", "ci/cd", "docker", "jenkins", "gitlab", "github actions"],
    "контейнер": ["devops", "docker", "kubernetes", "контейнеризация"],
    "деплой": ["devops", "ci/cd", "docker", "kubernetes", "облако"],

    # Data/ML
    "данн": ["data analyst", "sql", "python", "pandas", "аналитика", "bi"],
    "аналитик": ["data analyst", "sql", "python", "tableau", "power bi", "метрики"],
    "машинн": ["machine learning", "python", "tensorflow", "pytorch", "data science"],
    "нейрон": ["deep learning", "python", "tensorflow", "pytorch", "нейросети", "ai"],
    "искусствен": ["ai", "machine learning", "python", "nlp", "data science"],

    # Боты
    "бот": ["python", "chatbot", "telegram", "api", "backend", "автоматизация"],
    "telegram": ["python", "telegram", "bot", "api", "backend"],

    # Дизайн
    "дизайн": ["дизайн", "ui/ux", "figma", "photoshop", "веб-дизайн"],
    "интерфейс": ["ui/ux", "дизайн", "figma", "прототипирование", "frontend"],
    "логотип": ["дизайн", "графический дизайн", "illustrator", "брендинг"],

    # Прочее
    "парс": ["python", "парсинг", "scraping", "selenium", "beautifulsoup", "автоматизация"],
    "интеграц": ["api", "интеграция", "backend", "веб-сервисы", "rest"],
    "базы данных": ["sql", "postgresql", "mongodb", "backend", "базы данных", "dba"],
    "тестирован": ["qa", "тестирование", "автотесты", "selenium", "pytest"],
    "безопасност": ["security", "информационная безопасность", "pentest", "devops"],
}


class GroqTaskDecomposer:
    """
    Декомпозирует задачу в список требуемых навыков/технологий.

    Используется для поиска специалистов по описанию задачи.
    """

    # Кеш для частых задач
    _cache: dict[str, list[str]] = {}
    _cache_max_size: int = 300

    def __init__(self, groq_client: GroqClient):
        self._groq = groq_client

    async def decompose_task(self, task: str) -> list[str]:
        """
        Преобразовать описание задачи в список search_tags.

        Args:
            task: Описание задачи (например "Нужно создать сайт")

        Returns:
            Список нормализованных тегов для поиска специалистов

        Примеры:
            "Нужно создать сайт" → ["веб-разработчик", "frontend", "html", "css", ...]
            "Автоматизировать процессы" → ["devops", "python", "ci/cd", ...]
        """
        task_lower = task.lower().strip()

        # Проверяем кеш
        if task_lower in self._cache:
            logger.debug(f"Task decomposition cache hit: '{task}'")
            return self._cache[task_lower]

        # Если Groq не сконфигурирован, используем fallback
        if not self._groq.is_configured:
            result = self._fallback_decompose(task_lower)
            logger.warning(f"Groq not configured, using fallback for: '{task}'")
            return result

        try:
            response = await self._groq.complete(
                system_prompt=TASK_DECOMPOSITION_PROMPT.format(task=task),
                user_prompt=task,
                max_tokens=200,
                temperature=0.3,
            )

            tags = self._parse_response(response.content, task_lower)
            self._add_to_cache(task_lower, tags)

            logger.info(f"Task decomposed: '{task}' → {len(tags)} tags")
            return tags

        except GroqError as e:
            logger.warning(f"Groq error during task decomposition: {e}")
            return self._fallback_decompose(task_lower)
        except Exception as e:
            logger.error(f"Unexpected error during task decomposition: {e}")
            return self._fallback_decompose(task_lower)

    def _parse_response(self, content: str, original_task: str) -> list[str]:
        """Парсить JSON ответ от LLM."""
        content = content.strip()

        # Убираем markdown code block если есть
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
            content = content.strip()

        try:
            tags = json.loads(content)

            if not isinstance(tags, list):
                logger.warning(f"Response is not a list: {content[:100]}")
                return self._fallback_decompose(original_task)

            # Нормализуем теги
            result = []
            for tag in tags:
                if isinstance(tag, str):
                    normalized = tag.lower().strip()
                    if normalized and normalized not in result and len(normalized) <= 50:
                        result.append(normalized)

            return result[:15]

        except json.JSONDecodeError:
            # Пытаемся найти JSON массив в ответе
            array_match = re.search(r"\[.*\]", content, re.DOTALL)
            if array_match:
                try:
                    tags = json.loads(array_match.group())
                    if isinstance(tags, list):
                        return [t.lower().strip() for t in tags if isinstance(t, str)][:15]
                except json.JSONDecodeError:
                    pass

            logger.warning(f"Failed to parse task decomposition response: {content[:100]}")
            return self._fallback_decompose(original_task)

    def _fallback_decompose(self, task: str) -> list[str]:
        """
        Fallback декомпозиция на основе ключевых слов.

        Используется когда Groq недоступен.
        """
        result = set()

        # Ищем совпадения с keyword map
        for keyword, tags in TASK_KEYWORD_MAP.items():
            if keyword in task:
                result.update(tags)

        # Если ничего не нашли, возвращаем базовые теги
        if not result:
            result = {"разработка", "программирование", "it"}

        return list(result)[:15]

    def _add_to_cache(self, task: str, tags: list[str]) -> None:
        """Добавить результат в кеш."""
        if len(self._cache) >= self._cache_max_size:
            keys_to_remove = list(self._cache.keys())[: self._cache_max_size // 2]
            for key in keys_to_remove:
                del self._cache[key]

        self._cache[task] = tags

    def clear_cache(self) -> None:
        """Очистить кеш."""
        self._cache.clear()
