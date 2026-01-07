"""
Генерация search_tags из свободного текста через Groq.
Используется для генерации тегов из описания навыков пользователя.
"""

import json
import logging
import re

from infrastructure.llm.groq_client import GroqClient, GroqError

logger = logging.getLogger(__name__)


# Промпт для генерации тегов из текста
TEXT_TAGS_GENERATION_PROMPT = """Извлеки профессиональные навыки и технологии из описания пользователя.

Правила:
1. Верни JSON массив строк (search_tags)
2. Извлекай: языки программирования, фреймворки, инструменты, профессии, домены
3. Нормализуй к стандартным терминам:
   - Используй английские названия для технологий: Python (не питон), React (не реакт), JavaScript (не джаваскрипт)
   - Русские названия для профессий и доменов: веб-разработка, аналитика, дизайн
4. Всё в lowercase
5. Максимум 15 тегов, сортируй по релевантности (самые важные первые)
6. Включай как явно упомянутые навыки, так и подразумеваемые
7. Отвечай ТОЛЬКО JSON массивом, без пояснений

Примеры:

Текст: "Я занимаюсь веб-разработкой, работаю с React и Python, есть опыт с PostgreSQL"
Ответ: ["веб-разработка", "react", "python", "postgresql", "frontend", "backend", "javascript", "sql", "fullstack"]

Текст: "Дизайнер интерфейсов, работаю в Figma, знаю Photoshop, делаю анимации"
Ответ: ["ui/ux", "дизайн", "figma", "photoshop", "анимация", "веб-дизайн", "интерфейсы", "графический дизайн", "прототипирование"]

Текст: "DevOps инженер с опытом в AWS, настраиваю CI/CD пайплайны, работаю с Docker и Kubernetes"
Ответ: ["devops", "aws", "ci/cd", "docker", "kubernetes", "облако", "автоматизация", "linux", "инфраструктура"]

Текст: "Data Scientist, работаю с машинным обучением, Python, TensorFlow, анализирую большие данные"
Ответ: ["data science", "machine learning", "python", "tensorflow", "big data", "аналитика", "нейросети", "pandas", "ai"]

Текст: "Менеджер проектов в IT, работаю по Agile/Scrum, управляю командой разработчиков"
Ответ: ["project management", "agile", "scrum", "управление проектами", "it менеджмент", "team lead", "jira", "планирование"]

Текст: "{text}"
"""


# Fallback keywords для случаев когда Groq недоступен
KEYWORD_TAG_MAP = {
    # Языки программирования
    "python": ["python", "backend"],
    "питон": ["python", "backend"],
    "javascript": ["javascript", "frontend"],
    "js": ["javascript", "frontend"],
    "typescript": ["typescript", "frontend"],
    "java": ["java", "backend"],
    "c++": ["c++", "системное программирование"],
    "c#": ["c#", ".net", "backend"],
    "go": ["go", "golang", "backend"],
    "rust": ["rust", "системное программирование"],
    "php": ["php", "backend", "веб-разработка"],
    "ruby": ["ruby", "ruby on rails", "backend"],
    "swift": ["swift", "ios", "мобильная разработка"],
    "kotlin": ["kotlin", "android", "мобильная разработка"],

    # Фреймворки
    "react": ["react", "frontend", "javascript"],
    "реакт": ["react", "frontend", "javascript"],
    "vue": ["vue", "frontend", "javascript"],
    "angular": ["angular", "frontend", "typescript"],
    "django": ["django", "python", "backend"],
    "fastapi": ["fastapi", "python", "backend", "api"],
    "flask": ["flask", "python", "backend"],
    "node": ["node.js", "backend", "javascript"],
    "express": ["express", "node.js", "backend"],
    "spring": ["spring", "java", "backend"],
    "laravel": ["laravel", "php", "backend"],

    # Базы данных
    "postgresql": ["postgresql", "sql", "базы данных"],
    "postgres": ["postgresql", "sql", "базы данных"],
    "mysql": ["mysql", "sql", "базы данных"],
    "mongodb": ["mongodb", "nosql", "базы данных"],
    "redis": ["redis", "кеширование", "базы данных"],

    # DevOps
    "docker": ["docker", "devops", "контейнеризация"],
    "kubernetes": ["kubernetes", "devops", "k8s"],
    "k8s": ["kubernetes", "devops"],
    "aws": ["aws", "облако", "devops"],
    "azure": ["azure", "облако", "devops"],
    "ci/cd": ["ci/cd", "devops", "автоматизация"],
    "jenkins": ["jenkins", "ci/cd", "devops"],
    "gitlab": ["gitlab", "ci/cd", "devops"],

    # Data/ML
    "machine learning": ["machine learning", "python", "data science"],
    "ml": ["machine learning", "python", "data science"],
    "tensorflow": ["tensorflow", "machine learning", "deep learning"],
    "pytorch": ["pytorch", "machine learning", "deep learning"],
    "pandas": ["pandas", "python", "data analysis"],
    "data science": ["data science", "python", "аналитика"],

    # Дизайн
    "figma": ["figma", "ui/ux", "дизайн"],
    "photoshop": ["photoshop", "дизайн", "графический дизайн"],
    "illustrator": ["illustrator", "дизайн", "графический дизайн"],
    "ui": ["ui/ux", "дизайн", "интерфейсы"],
    "ux": ["ui/ux", "дизайн", "интерфейсы"],

    # Домены
    "веб": ["веб-разработка", "frontend"],
    "web": ["веб-разработка", "frontend"],
    "мобил": ["мобильная разработка"],
    "mobile": ["мобильная разработка"],
    "backend": ["backend", "серверная разработка"],
    "бэкенд": ["backend", "серверная разработка"],
    "frontend": ["frontend", "веб-разработка"],
    "фронтенд": ["frontend", "веб-разработка"],
    "fullstack": ["fullstack", "frontend", "backend"],
    "фулстек": ["fullstack", "frontend", "backend"],
}


class GroqTextTagsGenerator:
    """
    Генератор search_tags из произвольного текста.

    Используется когда пользователь описывает свои навыки в свободной форме.
    """

    # Кеш для частых текстов
    _cache: dict[str, list[str]] = {}
    _cache_max_size: int = 200

    def __init__(self, groq_client: GroqClient):
        self._groq = groq_client

    async def generate_tags_from_text(self, text: str) -> list[str]:
        """
        Извлечь теги из текстового описания.

        Args:
            text: Свободное описание навыков пользователя

        Returns:
            Список нормализованных search_tags

        Примеры:
            "Я занимаюсь веб-разработкой, работаю с React и Python..."
            → ["веб-разработка", "react", "python", "frontend", "backend", ...]
        """
        text_lower = text.lower().strip()

        # Проверяем кеш
        cache_key = text_lower[:200]  # Ограничиваем длину ключа
        if cache_key in self._cache:
            logger.debug(f"Text tags cache hit for: '{text[:50]}...'")
            return self._cache[cache_key]

        # Если Groq не сконфигурирован, используем fallback
        if not self._groq.is_configured:
            result = self._fallback_extract(text_lower)
            logger.warning(f"Groq not configured, using fallback for text tags")
            return result

        try:
            response = await self._groq.complete(
                system_prompt=TEXT_TAGS_GENERATION_PROMPT.format(text=text),
                user_prompt=text,
                max_tokens=200,
                temperature=0.3,
            )

            tags = self._parse_response(response.content, text_lower)
            self._add_to_cache(cache_key, tags)

            logger.info(f"Generated {len(tags)} tags from text")
            return tags

        except GroqError as e:
            logger.warning(f"Groq error during text tags generation: {e}")
            return self._fallback_extract(text_lower)
        except Exception as e:
            logger.error(f"Unexpected error during text tags generation: {e}")
            return self._fallback_extract(text_lower)

    def _parse_response(self, content: str, original_text: str) -> list[str]:
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
                return self._fallback_extract(original_text)

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

            logger.warning(f"Failed to parse text tags response: {content[:100]}")
            return self._fallback_extract(original_text)

    def _fallback_extract(self, text: str) -> list[str]:
        """
        Fallback извлечение тегов на основе ключевых слов.

        Используется когда Groq недоступен.
        """
        result = set()

        # Ищем совпадения с keyword map
        for keyword, tags in KEYWORD_TAG_MAP.items():
            if keyword in text:
                result.update(tags)

        # Если ничего не нашли, возвращаем базовые теги
        if not result:
            result = {"it", "разработка"}

        return list(result)[:15]

    def _add_to_cache(self, key: str, tags: list[str]) -> None:
        """Добавить результат в кеш."""
        if len(self._cache) >= self._cache_max_size:
            keys_to_remove = list(self._cache.keys())[: self._cache_max_size // 2]
            for k in keys_to_remove:
                del self._cache[k]

        self._cache[key] = tags

    def clear_cache(self) -> None:
        """Очистить кеш."""
        self._cache.clear()
