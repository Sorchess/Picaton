from dataclasses import dataclass
from uuid import UUID

from domain.entities.user import User
from domain.entities.business_card import BusinessCard
from domain.entities.saved_contact import SavedContact
from domain.repositories.user import UserRepositoryInterface
from domain.repositories.business_card import BusinessCardRepositoryInterface
from domain.repositories.saved_contact import SavedContactRepositoryInterface


@dataclass
class SearchResult:
    """Результат поиска."""

    users: list[User]
    cards: list[BusinessCard]  # Визитные карточки
    contacts: list[SavedContact]
    query: str
    expanded_tags: list[str]  # Расширенные теги после ассоциативного анализа
    total_count: int


# Ассоциативная карта: запрос → связанные теги/навыки
ASSOCIATIVE_MAP: dict[str, list[str]] = {
    # ===== ЗАДАЧИ И ПОТРЕБНОСТИ → специалисты/навыки =====
    # Сайты и веб-разработка
    "сделать сайт": [
        "веб-разработчик",
        "верстальщик",
        "верстка",
        "html",
        "css",
        "javascript",
        "react",
        "vue",
        "фронтенд",
        "frontend",
        "дизайн",
        "адаптивная вёрстка",
        "лендинг",
        "web",
    ],
    "создать сайт": [
        "веб-разработчик",
        "верстальщик",
        "верстка",
        "html",
        "css",
        "javascript",
        "react",
        "vue",
        "фронтенд",
        "frontend",
        "web",
    ],
    "разработать сайт": [
        "веб-разработчик",
        "верстальщик",
        "верстка",
        "html",
        "css",
        "javascript",
        "react",
        "vue",
        "фронтенд",
        "frontend",
        "web",
    ],
    "нужен сайт": [
        "веб-разработчик",
        "верстальщик",
        "верстка",
        "html",
        "css",
        "javascript",
        "react",
        "фронтенд",
        "web",
    ],
    "сайт": [
        "веб-разработчик",
        "верстальщик",
        "верстка",
        "фронтенд",
        "frontend",
        "html",
        "css",
        "javascript",
        "react",
        "дизайн",
        "web",
    ],
    "веб-разработка": [
        "веб-разработчик",
        "верстальщик",
        "фронтенд",
        "бэкенд",
        "fullstack",
        "html",
        "css",
        "javascript",
        "react",
        "node.js",
        "python",
    ],
    "web": [
        "веб-разработчик",
        "верстальщик",
        "фронтенд",
        "frontend",
        "html",
        "css",
        "javascript",
    ],
    "веб": [
        "веб-разработчик",
        "верстальщик",
        "фронтенд",
        "html",
        "css",
        "javascript",
    ],
    "верстка": [
        "верстальщик",
        "html",
        "css",
        "sass",
        "фронтенд",
        "адаптивная",
        "responsive",
    ],
    "сверстать": [
        "верстка",
        "html",
        "css",
        "sass",
        "адаптивная",
        "разметка",
        "вёрстка",
        "стилизация",
        "интерфейс",
    ],
    "лендинг": [
        "верстка",
        "html",
        "css",
        "landing page",
        "дизайн",
        "фронтенд",
        "javascript",
        "адаптивная",
    ],
    "интернет-магазин": [
        "ecommerce",
        "shopify",
        "woocommerce",
        "фронтенд",
        "бэкенд",
        "платежи",
        "интеграции",
        "react",
    ],
    # Мобильные приложения
    "сделать приложение": [
        "мобильная разработка",
        "ios",
        "android",
        "swift",
        "kotlin",
        "react native",
        "flutter",
        "mobile",
    ],
    "мобильное приложение": [
        "мобильная разработка",
        "ios",
        "android",
        "swift",
        "kotlin",
        "react native",
        "flutter",
        "mobile",
    ],
    "приложение для телефона": [
        "мобильная разработка",
        "ios",
        "android",
        "react native",
        "flutter",
        "mobile",
    ],
    "ios приложение": [
        "swift",
        "ios",
        "xcode",
        "objective-c",
        "mobile",
        "apple",
    ],
    "android приложение": [
        "kotlin",
        "java",
        "android",
        "mobile",
    ],
    # Боты и автоматизация
    "сделать бота": [
        "python",
        "telegram bot",
        "чат-бот",
        "автоматизация",
        "aiogram",
        "telebot",
        "discord",
        "bot",
    ],
    "телеграм бот": [
        "python",
        "telegram",
        "aiogram",
        "telebot",
        "бот",
        "автоматизация",
    ],
    "чат-бот": [
        "python",
        "nlp",
        "ai",
        "автоматизация",
        "диалоговые системы",
    ],
    "автоматизация": [
        "python",
        "скрипты",
        "api",
        "интеграции",
        "rpa",
        "selenium",
    ],
    # Дизайн
    "нарисовать дизайн": [
        "дизайнер",
        "ui",
        "ux",
        "figma",
        "photoshop",
        "sketch",
        "интерфейс",
        "прототип",
    ],
    "сделать дизайн": [
        "дизайнер",
        "ui",
        "ux",
        "figma",
        "photoshop",
        "интерфейс",
        "визуал",
    ],
    "макет": [
        "дизайнер",
        "figma",
        "ui",
        "прототип",
        "интерфейс",
    ],
    "логотип": [
        "дизайнер",
        "графический дизайн",
        "illustrator",
        "photoshop",
        "брендинг",
    ],
    # Данные и аналитика
    "проанализировать данные": [
        "аналитик",
        "data analyst",
        "sql",
        "python",
        "pandas",
        "excel",
        "power bi",
        "tableau",
    ],
    "дашборд": [
        "bi",
        "power bi",
        "tableau",
        "metabase",
        "аналитика",
        "визуализация",
    ],
    "отчёт": [
        "аналитик",
        "excel",
        "sql",
        "отчётность",
        "power bi",
    ],
    # ML/AI
    "нейросеть": [
        "machine learning",
        "deep learning",
        "python",
        "tensorflow",
        "pytorch",
        "ml",
        "ai",
    ],
    "машинное обучение": [
        "ml",
        "python",
        "tensorflow",
        "pytorch",
        "scikit-learn",
        "data science",
    ],
    "распознавание": [
        "computer vision",
        "opencv",
        "ml",
        "нейросети",
        "python",
    ],
    # Серверы и DevOps
    "настроить сервер": [
        "devops",
        "linux",
        "nginx",
        "docker",
        "системный администратор",
        "sysadmin",
    ],
    "развернуть проект": [
        "devops",
        "docker",
        "ci/cd",
        "kubernetes",
        "деплой",
    ],
    "деплой": [
        "devops",
        "docker",
        "ci/cd",
        "kubernetes",
        "aws",
        "gcp",
    ],
    # API и интеграции
    "сделать api": [
        "бэкенд",
        "backend",
        "rest",
        "graphql",
        "python",
        "node.js",
        "fastapi",
        "express",
    ],
    "интеграция": [
        "api",
        "rest",
        "бэкенд",
        "интеграции",
        "webhook",
    ],
    "парсинг": [
        "python",
        "scraping",
        "beautifulsoup",
        "selenium",
        "scrapy",
        "автоматизация",
    ],
    # ===== Роли и специализации → технологии =====
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
    "flask": [
        "python",
        "бэкенд",
        "backend",
        "веб-разработка",
        "api",
        "rest",
        "python разработчик",
        "бэкенд разработчик",
        "backend developer",
    ],
    "django": [
        "python",
        "бэкенд",
        "backend",
        "веб-разработка",
        "orm",
        "rest",
        "python разработчик",
        "бэкенд разработчик",
    ],
    "fastapi": [
        "python",
        "бэкенд",
        "backend",
        "api",
        "async",
        "rest",
        "python разработчик",
        "бэкенд разработчик",
    ],
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
    # Языки программирования
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
    # Задачи/действия
    "создать": "сделать",
    "разработать": "сделать",
    "написать": "сделать",
    "запилить": "сделать",
    "нужен": "сделать",
    "нужна": "сделать",
    "ищу": "сделать",
    # Веб-термины (убрали "сайт" чтобы он работал через ASSOCIATIVE_MAP)
    "веб-сайт": "сайт",
    "вебсайт": "сайт",
    "webapp": "веб-приложение",
    "верстальщик": "вёрстка",
    "стилизация": "вёрстка",
    "разметка": "вёрстка",
}


class AssociativeSearchService:
    """
    Сервис ассоциативного поиска экспертов и контактов.
    Позволяет искать по ассоциациям, тегам и семантически.
    Использует AI для интеллектуального расширения запросов.
    """

    def __init__(
        self,
        user_repository: UserRepositoryInterface,
        card_repository: BusinessCardRepositoryInterface,
        contact_repository: SavedContactRepositoryInterface,
        ai_search_service: "AISearchServiceInterface | None" = None,
        embedding_service: "EmbeddingServiceInterface | None" = None,
    ):
        self._user_repository = user_repository
        self._card_repository = card_repository
        self._contact_repository = contact_repository
        self._ai_search_service = ai_search_service
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
            include_users: Включать ли пользователей/карточки в результат
            include_contacts: Включать ли сохраненные контакты

        Returns:
            SearchResult с найденными карточками и контактами
        """
        users = []
        cards = []
        contacts = []

        # Расширяем запрос с помощью AI (приоритет) или статической карты
        if self._ai_search_service:
            try:
                ai_result = await self._ai_search_service.expand_query(query)
                expanded_tags = ai_result.expanded_tags
            except Exception:
                # Fallback на статическое расширение
                raw_tags = self._extract_tags(query)
                expanded_tags = self._expand_tags_associatively(raw_tags)
        else:
            # Используем статическое расширение
            raw_tags = self._extract_tags(query)
            expanded_tags = self._expand_tags_associatively(raw_tags)

        # Поиск визитных карточек (основной поиск)
        if include_users:
            # Сначала ищем по расширенным тегам в search_tags
            if expanded_tags:
                cards = await self._card_repository.search_by_tags(expanded_tags, limit)

            # Поиск по ключевым словам в bio
            if len(cards) < limit and expanded_tags:
                bio_results = await self._card_repository.search_by_bio_keywords(
                    expanded_tags, limit - len(cards)
                )
                existing_ids = {c.id for c in cards}
                for card in bio_results:
                    if card.id not in existing_ids:
                        cards.append(card)

            # Если мало результатов, добавляем полнотекстовый поиск
            if len(cards) < limit:
                text_results = await self._card_repository.search_by_text(
                    query, limit - len(cards)
                )
                # Добавляем только уникальные
                existing_ids = {c.id for c in cards}
                for card in text_results:
                    if card.id not in existing_ids:
                        cards.append(card)

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

        total_count = len(cards) + len(contacts)

        return SearchResult(
            users=users[:limit],
            cards=cards[:limit],
            contacts=contacts[:limit],
            query=query,
            expanded_tags=expanded_tags,
            total_count=total_count,
        )

    async def search_cards_only(
        self,
        query: str,
        limit: int = 20,
    ) -> list[BusinessCard]:
        """Поиск только среди визитных карточек."""
        result = await self.search(
            query=query,
            limit=limit,
            include_users=True,
            include_contacts=False,
        )
        return result.cards

    async def search_users_only(
        self,
        query: str,
        limit: int = 20,
    ) -> list[User]:
        """Поиск только среди пользователей (deprecated, используйте search_cards_only)."""
        # Для обратной совместимости возвращаем пустой список
        return []

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

        query_lower = query.lower().strip()
        tags = []
        matched_phrases = set()

        # Сортируем фразы по длине (от длинных к коротким) для правильного приоритета
        sorted_phrases = sorted(ASSOCIATIVE_MAP.keys(), key=len, reverse=True)

        # Проверяем полные фразы из ассоциативной карты
        for phrase in sorted_phrases:
            # Используем регулярное выражение для поиска фразы как целого слова/фразы
            # \b - граница слова
            pattern = r"\b" + re.escape(phrase) + r"\b"
            if re.search(pattern, query_lower):
                if phrase not in matched_phrases:
                    tags.append(phrase)
                    matched_phrases.add(phrase)

        # Затем разбиваем на отдельные слова
        words = re.split(r"[\s,#]+", query_lower)
        for word in words:
            word = word.strip()
            if word and len(word) >= 2:
                # Нормализуем синонимы
                normalized = SYNONYMS.get(word, word)
                if normalized not in tags and normalized not in matched_phrases:
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


class AISearchServiceInterface:
    """Интерфейс сервиса AI-расширения поисковых запросов."""

    async def expand_query(self, query: str):
        """Расширить поисковый запрос с помощью AI."""
        raise NotImplementedError


class EmbeddingServiceInterface:
    """Интерфейс сервиса embedding'ов для семантического поиска."""

    async def get_embedding(self, text: str) -> list[float]:
        """Получить embedding вектор для текста."""
        raise NotImplementedError
