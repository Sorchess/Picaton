from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class SuggestedTag:
    """Предложенный тег."""

    name: str
    category: str
    confidence: float  # 0-1, насколько уверены в теге
    reason: str  # Почему предложен этот тег


@dataclass
class GeneratedTags:
    """Результат генерации тегов."""

    suggested_tags: list[SuggestedTag] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)  # Для обратной совместимости
    skills: list[dict] = field(default_factory=list)


class AITagsGeneratorInterface(ABC):
    """Интерфейс генератора тегов на основе AI."""

    @abstractmethod
    async def generate_tags_from_bio(self, bio: str) -> GeneratedTags:
        """Сгенерировать теги и навыки на основе bio."""
        pass


class AITagsGeneratorService:
    """
    Сервис генерации тегов и навыков из описания пользователя.
    """

    def __init__(self, ai_client: AITagsGeneratorInterface):
        self._ai_client = ai_client

    async def generate_from_bio(self, bio: str) -> GeneratedTags:
        """
        Генерирует теги и навыки на основе bio пользователя.
        """
        if not bio or not bio.strip():
            return GeneratedTags(suggested_tags=[], tags=[], skills=[])

        return await self._ai_client.generate_tags_from_bio(bio)


class MockAITagsGenerator(AITagsGeneratorInterface):
    """
    Умный генератор тегов на основе анализа текста.
    Анализирует контекст и предлагает релевантные теги.
    """

    # Расширенный словарь ключевых слов с контекстом
    KEYWORD_MAPPING = {
        # Языки программирования
        "python": {
            "name": "Python",
            "category": "Языки",
            "related": ["Backend", "Data Science", "ML"],
        },
        "javascript": {
            "name": "JavaScript",
            "category": "Языки",
            "related": ["Frontend", "Web"],
        },
        "typescript": {
            "name": "TypeScript",
            "category": "Языки",
            "related": ["Frontend", "Backend"],
        },
        "java": {
            "name": "Java",
            "category": "Языки",
            "related": ["Backend", "Enterprise"],
        },
        "c++": {
            "name": "C++",
            "category": "Языки",
            "related": ["Systems", "Performance"],
        },
        "go": {
            "name": "Go",
            "category": "Языки",
            "related": ["Backend", "Microservices"],
        },
        "rust": {
            "name": "Rust",
            "category": "Языки",
            "related": ["Systems", "Performance"],
        },
        "php": {"name": "PHP", "category": "Языки", "related": ["Backend", "Web"]},
        "swift": {"name": "Swift", "category": "Языки", "related": ["iOS", "Mobile"]},
        "kotlin": {
            "name": "Kotlin",
            "category": "Языки",
            "related": ["Android", "Mobile"],
        },
        # Frontend
        "react": {
            "name": "React",
            "category": "Frontend",
            "related": ["JavaScript", "UI"],
        },
        "vue": {
            "name": "Vue.js",
            "category": "Frontend",
            "related": ["JavaScript", "UI"],
        },
        "angular": {
            "name": "Angular",
            "category": "Frontend",
            "related": ["TypeScript", "Enterprise"],
        },
        "верстк": {
            "name": "HTML/CSS",
            "category": "Frontend",
            "related": ["Web", "UI Design"],
        },
        "html": {"name": "HTML", "category": "Frontend", "related": ["Web", "Вёрстка"]},
        "css": {"name": "CSS", "category": "Frontend", "related": ["Web", "Стили"]},
        "sass": {
            "name": "SASS/SCSS",
            "category": "Frontend",
            "related": ["CSS", "Стили"],
        },
        "tailwind": {
            "name": "Tailwind CSS",
            "category": "Frontend",
            "related": ["CSS", "UI"],
        },
        # Backend
        "django": {
            "name": "Django",
            "category": "Backend",
            "related": ["Python", "Web"],
        },
        "fastapi": {
            "name": "FastAPI",
            "category": "Backend",
            "related": ["Python", "API"],
        },
        "flask": {"name": "Flask", "category": "Backend", "related": ["Python", "Web"]},
        "node": {
            "name": "Node.js",
            "category": "Backend",
            "related": ["JavaScript", "API"],
        },
        "express": {
            "name": "Express.js",
            "category": "Backend",
            "related": ["Node.js", "API"],
        },
        "spring": {
            "name": "Spring",
            "category": "Backend",
            "related": ["Java", "Enterprise"],
        },
        "api": {
            "name": "REST API",
            "category": "Backend",
            "related": ["Backend", "Интеграции"],
        },
        "graphql": {
            "name": "GraphQL",
            "category": "Backend",
            "related": ["API", "Frontend"],
        },
        # Базы данных
        "sql": {
            "name": "SQL",
            "category": "Базы данных",
            "related": ["Backend", "Данные"],
        },
        "postgresql": {
            "name": "PostgreSQL",
            "category": "Базы данных",
            "related": ["SQL", "Backend"],
        },
        "postgres": {
            "name": "PostgreSQL",
            "category": "Базы данных",
            "related": ["SQL", "Backend"],
        },
        "mysql": {
            "name": "MySQL",
            "category": "Базы данных",
            "related": ["SQL", "Backend"],
        },
        "mongodb": {
            "name": "MongoDB",
            "category": "Базы данных",
            "related": ["NoSQL", "Backend"],
        },
        "redis": {
            "name": "Redis",
            "category": "Базы данных",
            "related": ["Cache", "Backend"],
        },
        # DevOps
        "docker": {
            "name": "Docker",
            "category": "DevOps",
            "related": ["Контейнеры", "CI/CD"],
        },
        "kubernetes": {
            "name": "Kubernetes",
            "category": "DevOps",
            "related": ["Оркестрация", "Cloud"],
        },
        "k8s": {
            "name": "Kubernetes",
            "category": "DevOps",
            "related": ["Оркестрация", "Cloud"],
        },
        "ci/cd": {
            "name": "CI/CD",
            "category": "DevOps",
            "related": ["Автоматизация", "DevOps"],
        },
        "jenkins": {
            "name": "Jenkins",
            "category": "DevOps",
            "related": ["CI/CD", "Автоматизация"],
        },
        "gitlab": {
            "name": "GitLab CI",
            "category": "DevOps",
            "related": ["CI/CD", "Git"],
        },
        "aws": {"name": "AWS", "category": "Cloud", "related": ["Cloud", "DevOps"]},
        "azure": {
            "name": "Azure",
            "category": "Cloud",
            "related": ["Cloud", "Microsoft"],
        },
        "gcp": {
            "name": "Google Cloud",
            "category": "Cloud",
            "related": ["Cloud", "DevOps"],
        },
        # AI/ML
        "ml": {
            "name": "Machine Learning",
            "category": "AI/ML",
            "related": ["Data Science", "Python"],
        },
        "machine learning": {
            "name": "Machine Learning",
            "category": "AI/ML",
            "related": ["Data Science", "AI"],
        },
        "нейросет": {
            "name": "Neural Networks",
            "category": "AI/ML",
            "related": ["Deep Learning", "AI"],
        },
        "deep learning": {
            "name": "Deep Learning",
            "category": "AI/ML",
            "related": ["Neural Networks", "AI"],
        },
        "tensorflow": {
            "name": "TensorFlow",
            "category": "AI/ML",
            "related": ["Deep Learning", "Python"],
        },
        "pytorch": {
            "name": "PyTorch",
            "category": "AI/ML",
            "related": ["Deep Learning", "Python"],
        },
        "nlp": {
            "name": "NLP",
            "category": "AI/ML",
            "related": ["AI", "Text Processing"],
        },
        "computer vision": {
            "name": "Computer Vision",
            "category": "AI/ML",
            "related": ["AI", "Images"],
        },
        "data science": {
            "name": "Data Science",
            "category": "AI/ML",
            "related": ["Аналитика", "Python"],
        },
        # Дизайн
        "figma": {
            "name": "Figma",
            "category": "Дизайн",
            "related": ["UI", "Прототипирование"],
        },
        "photoshop": {
            "name": "Photoshop",
            "category": "Дизайн",
            "related": ["Графика", "Adobe"],
        },
        "illustrator": {
            "name": "Illustrator",
            "category": "Дизайн",
            "related": ["Векторная графика", "Adobe"],
        },
        "дизайн": {
            "name": "UI/UX Design",
            "category": "Дизайн",
            "related": ["Интерфейсы", "Figma"],
        },
        "design": {"name": "Design", "category": "Дизайн", "related": ["UI", "UX"]},
        "ui": {
            "name": "UI Design",
            "category": "Дизайн",
            "related": ["Интерфейсы", "Figma"],
        },
        "ux": {
            "name": "UX Design",
            "category": "Дизайн",
            "related": ["Пользовательский опыт", "Research"],
        },
        "интерфейс": {
            "name": "UI Design",
            "category": "Дизайн",
            "related": ["Дизайн", "Frontend"],
        },
        # Аналитика
        "аналитик": {
            "name": "Аналитика",
            "category": "Аналитика",
            "related": ["Данные", "BI"],
        },
        "analyst": {
            "name": "Analytics",
            "category": "Аналитика",
            "related": ["Data", "BI"],
        },
        "bi": {
            "name": "BI",
            "category": "Аналитика",
            "related": ["Дашборды", "Данные"],
        },
        "tableau": {
            "name": "Tableau",
            "category": "Аналитика",
            "related": ["BI", "Визуализация"],
        },
        "power bi": {
            "name": "Power BI",
            "category": "Аналитика",
            "related": ["BI", "Microsoft"],
        },
        # Менеджмент
        "менеджер": {
            "name": "Менеджмент",
            "category": "Менеджмент",
            "related": ["Управление", "Команда"],
        },
        "pm": {
            "name": "Project Management",
            "category": "Менеджмент",
            "related": ["Проекты", "Agile"],
        },
        "product": {
            "name": "Product Management",
            "category": "Менеджмент",
            "related": ["Продукт", "Strategy"],
        },
        "продукт": {
            "name": "Product",
            "category": "Менеджмент",
            "related": ["Стратегия", "Roadmap"],
        },
        "scrum": {
            "name": "Scrum",
            "category": "Методологии",
            "related": ["Agile", "Спринты"],
        },
        "agile": {
            "name": "Agile",
            "category": "Методологии",
            "related": ["Scrum", "Kanban"],
        },
        "kanban": {
            "name": "Kanban",
            "category": "Методологии",
            "related": ["Agile", "Процессы"],
        },
        # Специфичные контексты
        "высоконагружен": {
            "name": "Highload",
            "category": "Специализация",
            "related": ["Оптимизация", "Масштабирование"],
        },
        "оптимизир": {
            "name": "Оптимизация",
            "category": "Специализация",
            "related": ["Performance", "Highload"],
        },
        "масштабир": {
            "name": "Масштабирование",
            "category": "Специализация",
            "related": ["Архитектура", "Highload"],
        },
        "микросервис": {
            "name": "Микросервисы",
            "category": "Архитектура",
            "related": ["Backend", "Docker"],
        },
        "архитектур": {
            "name": "Архитектура",
            "category": "Специализация",
            "related": ["System Design", "Backend"],
        },
        "тестирован": {
            "name": "Тестирование",
            "category": "QA",
            "related": ["Автотесты", "Quality"],
        },
        "автотест": {
            "name": "Автотесты",
            "category": "QA",
            "related": ["Testing", "CI/CD"],
        },
        "разработ": {
            "name": "Разработка",
            "category": "Общее",
            "related": ["Программирование", "IT"],
        },
    }

    # Контекстные правила для улучшения понимания
    CONTEXT_RULES = [
        # Если есть "вёрстка" или "интерфейс", добавить HTML/CSS
        (["верстк", "вёрстк"], ["HTML", "CSS", "Frontend"]),
        # Если есть "дизайн" + "интерфейс", добавить UI Design
        (["дизайн", "интерфейс"], ["UI Design", "Figma"]),
        # Если есть "высоконагруженн" + "api", добавить Highload
        (["высоконагружен", "api"], ["Highload", "REST API", "Оптимизация"]),
        # Python разработчик
        (["python", "разработ"], ["Python", "Backend"]),
    ]

    async def generate_tags_from_bio(self, bio: str) -> GeneratedTags:
        """Сгенерировать теги на основе bio с объяснением."""
        bio_lower = bio.lower()

        suggested_tags: list[SuggestedTag] = []
        seen_names = set()

        # Поиск прямых совпадений
        for keyword, info in self.KEYWORD_MAPPING.items():
            if keyword in bio_lower and info["name"] not in seen_names:
                seen_names.add(info["name"])
                confidence = 0.9 if len(keyword) > 3 else 0.7
                suggested_tags.append(
                    SuggestedTag(
                        name=info["name"],
                        category=info["category"],
                        confidence=confidence,
                        reason=f"Найдено в тексте: «{keyword}»",
                    )
                )

                # Добавляем связанные теги с меньшей уверенностью
                for related in info.get("related", [])[:2]:
                    if related not in seen_names:
                        seen_names.add(related)
                        suggested_tags.append(
                            SuggestedTag(
                                name=related,
                                category="Связанное",
                                confidence=0.5,
                                reason=f"Связано с {info['name']}",
                            )
                        )

        # Применяем контекстные правила
        for triggers, tags_to_add in self.CONTEXT_RULES:
            if all(t in bio_lower for t in triggers):
                for tag in tags_to_add:
                    if tag not in seen_names:
                        seen_names.add(tag)
                        suggested_tags.append(
                            SuggestedTag(
                                name=tag,
                                category="Контекст",
                                confidence=0.6,
                                reason=f"На основе контекста: {', '.join(triggers)}",
                            )
                        )

        # Сортируем по уверенности
        suggested_tags.sort(key=lambda x: x.confidence, reverse=True)

        # Ограничиваем количество
        suggested_tags = suggested_tags[:15]

        # Для обратной совместимости
        tags = [t.name.lower() for t in suggested_tags if t.confidence > 0.6]
        skills = [
            {
                "name": t.name,
                "category": t.category,
                "proficiency": int(t.confidence * 5),
            }
            for t in suggested_tags
            if t.confidence > 0.7
        ]

        return GeneratedTags(
            suggested_tags=suggested_tags,
            tags=tags[:10],
            skills=skills[:8],
        )
