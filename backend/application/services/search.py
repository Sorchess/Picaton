from dataclasses import dataclass
from uuid import UUID

from domain.entities.user import User
from domain.entities.saved_contact import SavedContact
from domain.repositories.user import UserRepositoryInterface
from domain.repositories.saved_contact import SavedContactRepositoryInterface


@dataclass
class SearchResult:
    """Результат поиска."""

    users: list[User]
    contacts: list[SavedContact]
    query: str
    expanded_tags: list[str]  # Расширенные теги после ассоциативного анализа
    total_count: int


# Ассоциативная карта: запрос → связанные теги/навыки
ASSOCIATIVE_MAP: dict[str, list[str]] = {
    # Роли и специализации → технологии
    "бэкенд": [
        "python",
        "java",
        "node.js",
        "go",
        "rust",
        "php",
        "c#",
        "django",
        "fastapi",
        "spring",
        "express",
        "postgresql",
        "mongodb",
        "redis",
        "api",
        "rest",
        "graphql",
        "микросервисы",
    ],
    "backend": [
        "python",
        "java",
        "node.js",
        "go",
        "rust",
        "php",
        "c#",
        "django",
        "fastapi",
        "spring",
        "express",
        "postgresql",
        "mongodb",
        "redis",
        "api",
        "rest",
        "graphql",
        "microservices",
    ],
    "фронтенд": [
        "javascript",
        "typescript",
        "react",
        "vue",
        "angular",
        "svelte",
        "html",
        "css",
        "sass",
        "webpack",
        "vite",
        "next.js",
        "nuxt",
        "tailwind",
    ],
    "frontend": [
        "javascript",
        "typescript",
        "react",
        "vue",
        "angular",
        "svelte",
        "html",
        "css",
        "sass",
        "webpack",
        "vite",
        "next.js",
        "nuxt",
        "tailwind",
    ],
    "фуллстек": [
        "javascript",
        "typescript",
        "python",
        "react",
        "node.js",
        "postgresql",
        "mongodb",
        "docker",
        "api",
    ],
    "fullstack": [
        "javascript",
        "typescript",
        "python",
        "react",
        "node.js",
        "postgresql",
        "mongodb",
        "docker",
        "api",
    ],
    "мобильный": [
        "swift",
        "kotlin",
        "react native",
        "flutter",
        "ios",
        "android",
        "dart",
        "objective-c",
        "java",
    ],
    "mobile": [
        "swift",
        "kotlin",
        "react native",
        "flutter",
        "ios",
        "android",
        "dart",
        "objective-c",
        "java",
    ],
    "девопс": [
        "docker",
        "kubernetes",
        "ci/cd",
        "jenkins",
        "gitlab",
        "github actions",
        "terraform",
        "ansible",
        "aws",
        "gcp",
        "azure",
        "linux",
        "nginx",
    ],
    "devops": [
        "docker",
        "kubernetes",
        "ci/cd",
        "jenkins",
        "gitlab",
        "github actions",
        "terraform",
        "ansible",
        "aws",
        "gcp",
        "azure",
        "linux",
        "nginx",
    ],
    "дата сайнс": [
        "python",
        "pandas",
        "numpy",
        "scikit-learn",
        "tensorflow",
        "pytorch",
        "jupyter",
        "sql",
        "машинное обучение",
        "статистика",
        "r",
    ],
    "data science": [
        "python",
        "pandas",
        "numpy",
        "scikit-learn",
        "tensorflow",
        "pytorch",
        "jupyter",
        "sql",
        "machine learning",
        "statistics",
        "r",
    ],
    "ml": [
        "python",
        "tensorflow",
        "pytorch",
        "keras",
        "scikit-learn",
        "нейросети",
        "deep learning",
        "nlp",
        "computer vision",
    ],
    "machine learning": [
        "python",
        "tensorflow",
        "pytorch",
        "keras",
        "scikit-learn",
        "neural networks",
        "deep learning",
        "nlp",
        "computer vision",
    ],
    "аналитик": [
        "sql",
        "python",
        "excel",
        "power bi",
        "tableau",
        "looker",
        "metabase",
        "clickhouse",
        "статистика",
        "a/b тесты",
    ],
    "analyst": [
        "sql",
        "python",
        "excel",
        "power bi",
        "tableau",
        "looker",
        "metabase",
        "clickhouse",
        "statistics",
        "a/b testing",
    ],
    # Уровни экспертизы → опыт/качества
    "эксперт": [
        "senior",
        "lead",
        "architect",
        "tech lead",
        "principal",
        "высоконагруженные системы",
        "микросервисы",
        "оптимизация",
    ],
    "expert": [
        "senior",
        "lead",
        "architect",
        "tech lead",
        "principal",
        "high-load",
        "microservices",
        "optimization",
    ],
    "сеньор": ["senior", "lead", "5+ лет", "архитектура", "менторинг", "код ревью"],
    "senior": [
        "senior",
        "lead",
        "5+ years",
        "architecture",
        "mentoring",
        "code review",
    ],
    "мидл": ["middle", "3+ года", "самостоятельность"],
    "middle": ["middle", "3+ years", "independent"],
    "джуниор": ["junior", "стажёр", "начинающий", "обучаемость"],
    "junior": ["junior", "trainee", "beginner", "learning"],
    # Технологии → смежные технологии
    "python": ["django", "fastapi", "flask", "asyncio", "pandas", "numpy", "pytest"],
    "javascript": ["typescript", "react", "vue", "node.js", "npm", "webpack", "babel"],
    "react": ["javascript", "typescript", "redux", "next.js", "hooks", "jsx"],
    "vue": ["javascript", "typescript", "vuex", "nuxt", "composition api"],
    "node": ["javascript", "typescript", "express", "nest.js", "npm", "api"],
    "node.js": ["javascript", "typescript", "express", "nest.js", "npm", "api"],
    "java": ["spring", "maven", "gradle", "hibernate", "microservices", "kotlin"],
    "go": ["golang", "goroutines", "gin", "echo", "микросервисы"],
    "golang": ["go", "goroutines", "gin", "echo", "microservices"],
    "docker": ["kubernetes", "контейнеризация", "devops", "ci/cd", "docker-compose"],
    "kubernetes": ["docker", "k8s", "helm", "devops", "оркестрация"],
    "k8s": ["kubernetes", "docker", "helm", "devops"],
    "aws": ["cloud", "ec2", "s3", "lambda", "rds", "devops"],
    "postgresql": ["sql", "база данных", "postgres", "database"],
    "postgres": ["postgresql", "sql", "database"],
    "mongodb": ["nosql", "база данных", "mongoose", "database"],
    "redis": ["кеширование", "cache", "nosql", "pub/sub"],
    # Домены → специализации
    "финтех": [
        "python",
        "java",
        "scala",
        "kafka",
        "безопасность",
        "высоконагруженные",
        "банки",
    ],
    "fintech": ["python", "java", "scala", "kafka", "security", "high-load", "banking"],
    "геймдев": ["unity", "unreal", "c++", "c#", "игры", "3d", "графика"],
    "gamedev": ["unity", "unreal", "c++", "c#", "games", "3d", "graphics"],
    "блокчейн": ["solidity", "ethereum", "web3", "смарт-контракты", "crypto"],
    "blockchain": ["solidity", "ethereum", "web3", "smart contracts", "crypto"],
    "ecommerce": ["shopify", "magento", "woocommerce", "платежи", "интеграции"],
    # UI/UX
    "дизайнер": [
        "figma",
        "sketch",
        "photoshop",
        "ui",
        "ux",
        "прототипирование",
        "вёрстка",
    ],
    "designer": ["figma", "sketch", "photoshop", "ui", "ux", "prototyping", "layout"],
    "ui": ["figma", "дизайн", "интерфейс", "вёрстка", "css", "tailwind"],
    "ux": ["исследования", "прототипы", "user research", "usability", "figma"],
    "вёрстка": ["html", "css", "sass", "tailwind", "responsive", "адаптивная"],
    # Менеджмент
    "менеджер": ["управление", "agile", "scrum", "kanban", "jira", "команда"],
    "manager": ["management", "agile", "scrum", "kanban", "jira", "team"],
    "тимлид": ["team lead", "управление", "менторинг", "архитектура", "код ревью"],
    "team lead": ["тимлид", "management", "mentoring", "architecture", "code review"],
    "продакт": ["product", "аналитика", "roadmap", "user stories", "метрики"],
    "product": ["продакт", "analytics", "roadmap", "user stories", "metrics"],
    "проджект": ["project", "планирование", "сроки", "риски", "команда"],
    "project": ["проджект", "planning", "deadlines", "risks", "team"],
    # QA
    "тестировщик": ["qa", "тестирование", "автотесты", "selenium", "pytest", "postman"],
    "qa": [
        "тестирование",
        "автотесты",
        "selenium",
        "cypress",
        "pytest",
        "postman",
        "jira",
    ],
    "автотесты": ["selenium", "cypress", "playwright", "pytest", "jest", "ci/cd"],
}

# Синонимы для нормализации запросов
SYNONYMS: dict[str, str] = {
    "питон": "python",
    "пайтон": "python",
    "джава": "java",
    "джаваскрипт": "javascript",
    "js": "javascript",
    "ts": "typescript",
    "реакт": "react",
    "вью": "vue",
    "ангуляр": "angular",
    "нода": "node.js",
    "нод": "node.js",
    "ноджс": "node.js",
    "постгрес": "postgresql",
    "монго": "mongodb",
    "редис": "redis",
    "докер": "docker",
    "кубер": "kubernetes",
    "кубернетес": "kubernetes",
    "девопс": "devops",
    "сишарп": "c#",
    "шарп": "c#",
    "плюсы": "c++",
    "си плюс плюс": "c++",
    "гоу": "go",
    "голанг": "golang",
    "раст": "rust",
    "руби": "ruby",
    "пхп": "php",
    "свифт": "swift",
    "котлин": "kotlin",
    "флаттер": "flutter",
    "фигма": "figma",
    "фотошоп": "photoshop",
    "иллюстратор": "illustrator",
}


class AssociativeSearchService:
    """
    Сервис ассоциативного поиска экспертов и контактов.
    Позволяет искать по ассоциациям, тегам и семантически.
    """

    def __init__(
        self,
        user_repository: UserRepositoryInterface,
        contact_repository: SavedContactRepositoryInterface,
        embedding_service: "EmbeddingServiceInterface | None" = None,
    ):
        self._user_repository = user_repository
        self._contact_repository = contact_repository
        self._embedding_service = embedding_service

    async def search(
        self,
        query: str,
        owner_id: UUID | None = None,
        limit: int = 20,
        include_users: bool = True,
        include_contacts: bool = True,
    ) -> SearchResult:
        """
        Выполнить ассоциативный поиск.

        Args:
            query: Поисковый запрос (теги, ассоциации, имена)
            owner_id: ID владельца для поиска в его контактах
            limit: Максимальное количество результатов
            include_users: Включать ли пользователей в результат
            include_contacts: Включать ли сохраненные контакты

        Returns:
            SearchResult с найденными пользователями и контактами
        """
        users = []
        contacts = []

        # Разбиваем запрос на теги и расширяем ассоциативно
        raw_tags = self._extract_tags(query)
        expanded_tags = self._expand_tags_associatively(raw_tags)

        # Поиск пользователей
        if include_users:
            # Сначала ищем по расширенным тегам
            if expanded_tags:
                users = await self._user_repository.search_by_tags(expanded_tags, limit)

            # Если мало результатов, добавляем полнотекстовый поиск
            if len(users) < limit:
                text_results = await self._user_repository.search_by_text(
                    query, limit - len(users)
                )
                # Добавляем только уникальные
                existing_ids = {u.id for u in users}
                for user in text_results:
                    if user.id not in existing_ids:
                        users.append(user)

            # Семантический поиск если есть embedding service
            if self._embedding_service and len(users) < limit:
                try:
                    embedding = await self._embedding_service.get_embedding(query)
                    semantic_results = await self._user_repository.search_by_embedding(
                        embedding, limit - len(users)
                    )
                    existing_ids = {u.id for u in users}
                    for user in semantic_results:
                        if user.id not in existing_ids:
                            users.append(user)
                except Exception:
                    pass  # Если embedding не работает, продолжаем без него

        # Поиск в сохраненных контактах
        if include_contacts and owner_id:
            # Поиск по расширенным тегам
            if expanded_tags:
                contacts = await self._contact_repository.search_by_tags(
                    owner_id, expanded_tags, limit
                )

            # Полнотекстовый поиск
            if len(contacts) < limit:
                text_contacts = await self._contact_repository.search_by_text(
                    owner_id, query, limit - len(contacts)
                )
                existing_ids = {c.id for c in contacts}
                for contact in text_contacts:
                    if contact.id not in existing_ids:
                        contacts.append(contact)

        total_count = len(users) + len(contacts)

        return SearchResult(
            users=users[:limit],
            contacts=contacts[:limit],
            query=query,
            expanded_tags=expanded_tags,
            total_count=total_count,
        )

    async def search_users_only(
        self,
        query: str,
        limit: int = 20,
    ) -> list[User]:
        """Поиск только среди пользователей."""
        result = await self.search(
            query=query,
            limit=limit,
            include_users=True,
            include_contacts=False,
        )
        return result.users

    async def search_contacts_only(
        self,
        owner_id: UUID,
        query: str,
        limit: int = 20,
    ) -> list[SavedContact]:
        """Поиск только среди сохраненных контактов."""
        result = await self.search(
            query=query,
            owner_id=owner_id,
            limit=limit,
            include_users=False,
            include_contacts=True,
        )
        return result.contacts

    def _extract_tags(self, query: str) -> list[str]:
        """Извлечь теги из поискового запроса с нормализацией синонимов."""
        import re

        words = re.split(r"[\s,#]+", query.lower())
        tags = []

        for word in words:
            word = word.strip()
            if word and len(word) >= 2:
                # Нормализуем синонимы
                normalized = SYNONYMS.get(word, word)
                if normalized not in tags:
                    tags.append(normalized)

        return tags

    def _expand_tags_associatively(self, tags: list[str]) -> list[str]:
        """
        Расширить теги ассоциативно.

        Например: ["бэкенд", "эксперт"] → ["бэкенд", "эксперт", "python", "java", "senior", ...]
        """
        expanded = set(tags)  # Сохраняем оригинальные теги

        for tag in tags:
            # Ищем прямые ассоциации
            if tag in ASSOCIATIVE_MAP:
                for associated in ASSOCIATIVE_MAP[tag]:
                    expanded.add(associated.lower())

            # Ищем частичные совпадения (например, "бэкенд" в "бэкенд разработчик")
            for key, associations in ASSOCIATIVE_MAP.items():
                if tag in key or key in tag:
                    for associated in associations:
                        expanded.add(associated.lower())

        return list(expanded)

    def get_search_suggestions(self, query: str, limit: int = 10) -> list[str]:
        """
        Получить подсказки для поиска на основе ассоциаций.

        Полезно для автодополнения в UI.
        """
        query_lower = query.lower().strip()
        suggestions = set()

        # Ищем совпадения в ключах ассоциативной карты
        for key in ASSOCIATIVE_MAP.keys():
            if query_lower in key or key.startswith(query_lower):
                suggestions.add(key)
                # Добавляем несколько связанных тегов
                for tag in ASSOCIATIVE_MAP[key][:3]:
                    suggestions.add(tag)

        # Ищем совпадения в синонимах
        for syn, normalized in SYNONYMS.items():
            if query_lower in syn or syn.startswith(query_lower):
                suggestions.add(normalized)

        return sorted(suggestions)[:limit]


class EmbeddingServiceInterface:
    """Интерфейс сервиса embedding'ов для семантического поиска."""

    async def get_embedding(self, text: str) -> list[float]:
        """Получить embedding вектор для текста."""
        raise NotImplementedError
