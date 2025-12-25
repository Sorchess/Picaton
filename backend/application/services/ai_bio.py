from abc import ABC, abstractmethod
from dataclasses import dataclass
import re

from domain.entities.user import User


@dataclass
class GeneratedBio:
    """Результат генерации самопрезентации."""

    bio: str
    tokens_used: int = 0


class AIBioGeneratorInterface(ABC):
    """Интерфейс генератора самопрезентации на основе AI."""

    @abstractmethod
    async def generate_bio(self, user: User) -> GeneratedBio:
        """Сгенерировать самопрезентацию на основе данных о пользователе."""
        pass

    @abstractmethod
    async def generate_from_facts(self, facts: list[str], name: str) -> GeneratedBio:
        """Сгенерировать самопрезентацию из списка фактов."""
        pass


class AIBioGeneratorService:
    """
    Сервис генерации самопрезентации на основе информации о пользователе.
    Использует AI для преобразования bio в краткую профессиональную презентацию.
    """

    def __init__(self, ai_client: AIBioGeneratorInterface):
        self._ai_client = ai_client

    async def generate_bio_from_user(self, user: User) -> str:
        """
        Генерирует самопрезентацию для пользователя на основе его данных.
        """
        result = await self._ai_client.generate_bio(user)
        return result.bio

    async def generate_bio_from_facts(self, facts: list[str], name: str) -> str:
        """
        Генерирует самопрезентацию из списка фактов.
        """
        if not facts:
            return ""

        result = await self._ai_client.generate_from_facts(facts, name)
        return result.bio


class MockAIBioGenerator(AIBioGeneratorInterface):
    """
    Умный генератор самопрезентации.
    Анализирует bio пользователя и создаёт профессиональное описание.
    """

    # Шаблоны для разных профессий
    ROLE_TEMPLATES = {
        "developer": [
            "Опытный разработчик, специализирующийся на {skills}.",
            "Создаю качественные технические решения в области {skills}.",
            "Разработчик с фокусом на {skills} и современные технологии.",
        ],
        "designer": [
            "Креативный дизайнер, работающий с {skills}.",
            "Создаю визуальные решения в сфере {skills}.",
            "Дизайнер с экспертизой в {skills}.",
        ],
        "manager": [
            "Эффективный менеджер с опытом в {skills}.",
            "Управляю проектами и командами в области {skills}.",
            "Менеджер, специализирующийся на {skills}.",
        ],
        "analyst": [
            "Аналитик с экспертизой в {skills}.",
            "Занимаюсь анализом и оптимизацией в сфере {skills}.",
            "Превращаю данные в решения, специализируясь на {skills}.",
        ],
        "general": [
            "Специалист с опытом в {skills}.",
            "Профессионал в области {skills}.",
            "Эксперт, работающий с {skills}.",
        ],
    }

    # Явные указания на роль (высокий приоритет)
    EXPLICIT_ROLE_PATTERNS = {
        "developer": ["разработчик", "программист", "developer", "инженер", "engineer"],
        "designer": ["дизайнер", "designer", "художник", "иллюстратор"],
        "manager": [
            "менеджер",
            "manager",
            "руководитель",
            "директор",
            "тимлид",
            "team lead",
        ],
        "analyst": ["аналитик", "analyst", "исследователь", "researcher"],
    }

    # Ключевые слова для определения роли
    ROLE_KEYWORDS = {
        "developer": [
            "разработ",
            "программ",
            "код",
            "developer",
            "backend",
            "frontend",
            "fullstack",
            "python",
            "javascript",
            "java",
            "react",
            "vue",
            "node",
            "api",
            "базы данных",
            "database",
            "devops",
            "ml",
            "ai",
        ],
        "designer": [
            "дизайн",
            "design",
            "ui",
            "ux",
            "figma",
            "photoshop",
            "illustrator",
            "график",
            "визуал",
            "интерфейс",
            "верстк",
            "creative",
        ],
        "manager": [
            "менеджер",
            "manager",
            "управлен",
            "руковод",
            "лидер",
            "leader",
            "product",
            "project",
            "scrum",
            "agile",
            "team lead",
            "тимлид",
        ],
        "analyst": [
            "аналитик",
            "analyst",
            "анализ",
            "данны",
            "data",
            "bi",
            "метрик",
            "исследован",
            "research",
            "статистик",
        ],
    }

    # Слова-усилители для достижений (с контекстом)
    ACHIEVEMENT_PATTERNS = [
        # pattern, template, context_keywords (если есть рядом — используем контекст)
        (r"оптимизир\w*.*?(\d+)\s*%", "оптимизация на {0}%"),
        (
            r"(\d+)\s*%.*?(?:быстрее|производительн|оптимиз)",
            "повышение производительности на {0}%",
        ),
        (r"ускор\w*.*?(\d+)\s*%", "ускорение на {0}%"),
        (r"(\d+)\s*%", "улучшение метрик на {0}%"),  # fallback
        (r"(\d+)\s*(?:раз|x|х)\s*(?:быстрее|производительн)", "ускорение в {0} раз"),
        (r"(\d+)\s*(?:раз|x|х)", "улучшение в {0} раз"),
        (r"(\d+)\+?\s*(?:лет|год)\w*\s*(?:опыт|стаж)", "опыт {0}+ лет"),
        (r"(?:опыт|стаж)\w*\s*(\d+)\+?\s*(?:лет|год)", "опыт {0}+ лет"),
        (r"(\d+)\+?\s*(?:лет|год)", "опыт {0}+ лет"),
        (r"(\d+)\+?\s*(?:проект|клиент)", "{0}+ реализованных проектов"),
    ]

    # Качественные прилагательные
    QUALITY_WORDS = [
        "высоконагруженн",
        "масштабир",
        "оптимизир",
        "автоматизир",
        "инновацион",
        "эффективн",
        "современн",
        "профессиональн",
    ]

    async def generate_bio(self, user: User) -> GeneratedBio:
        """Сгенерировать профессиональную самопрезентацию."""
        bio_text = user.bio or ""
        name = user.first_name or user.full_name.split()[0] if user.full_name else ""

        if not bio_text.strip():
            # Если нет bio, создаём минимальное описание
            if user.random_facts:
                return await self.generate_from_facts(user.random_facts, name)
            return GeneratedBio(bio=f"Привет! Меня зовут {user.full_name}.")

        # Анализируем bio и создаём презентацию
        presentation = self._create_presentation(bio_text, name)
        return GeneratedBio(bio=presentation)

    async def generate_from_facts(self, facts: list[str], name: str) -> GeneratedBio:
        """Сгенерировать самопрезентацию из списка фактов."""
        if not facts:
            return GeneratedBio(bio=f"Привет! Меня зовут {name}.")

        combined = " ".join(facts)
        presentation = self._create_presentation(combined, name)
        return GeneratedBio(bio=presentation)

    def _create_presentation(self, text: str, name: str) -> str:
        """Создать профессиональную презентацию из текста."""
        text_lower = text.lower()

        # 1. Определяем роль
        role = self._detect_role(text_lower)

        # 2. Извлекаем ключевые навыки
        skills = self._extract_skills(text_lower)

        # 3. Извлекаем достижения
        achievements = self._extract_achievements(text)

        # 4. Извлекаем качества
        qualities = self._extract_qualities(text_lower)

        # 5. Собираем презентацию
        presentation = self._build_presentation(
            name, role, skills, achievements, qualities
        )

        return presentation

    def _detect_role(self, text: str) -> str:
        """Определить профессиональную роль."""
        # Сначала ищем явные указания роли (высокий приоритет)
        for role, patterns in self.EXPLICIT_ROLE_PATTERNS.items():
            for pattern in patterns:
                if pattern in text:
                    return role

        # Если явной роли нет, считаем по ключевым словам
        role_scores = {role: 0 for role in self.ROLE_KEYWORDS}

        for role, keywords in self.ROLE_KEYWORDS.items():
            for keyword in keywords:
                if keyword in text:
                    role_scores[role] += 1

        best_role = max(role_scores, key=role_scores.get)
        return best_role if role_scores[best_role] > 0 else "general"

    def _extract_skills(self, text: str) -> list[str]:
        """Извлечь ключевые навыки из текста."""
        skill_map = {
            "python": "Python",
            "javascript": "JavaScript",
            "typescript": "TypeScript",
            "react": "React",
            "vue": "Vue.js",
            "node": "Node.js",
            "django": "Django",
            "fastapi": "FastAPI",
            "sql": "SQL",
            "postgresql": "PostgreSQL",
            "mongodb": "MongoDB",
            "docker": "Docker",
            "kubernetes": "Kubernetes",
            "aws": "AWS",
            "figma": "Figma",
            "photoshop": "Photoshop",
            "верстк": "вёрстка",
            "ui": "UI",
            "ux": "UX",
            "дизайн": "дизайн",
            "api": "API",
            "backend": "backend",
            "frontend": "frontend",
            "ml": "машинное обучение",
            "data science": "Data Science",
            "аналитик": "аналитика",
            "управлен": "управление проектами",
            "scrum": "Scrum",
            "agile": "Agile",
        }

        found_skills = []
        for keyword, skill_name in skill_map.items():
            if keyword in text and skill_name not in found_skills:
                found_skills.append(skill_name)

        return found_skills[:5]  # Максимум 5 навыков

    def _extract_achievements(self, text: str) -> list[str]:
        """Извлечь достижения с числами и контекстом."""
        achievements = []
        used_numbers = set()  # Избегаем дублирования

        for pattern, template in self.ACHIEVEMENT_PATTERNS:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                number = match if isinstance(match, str) else match[0]
                if number not in used_numbers:
                    achievements.append(template.format(number))
                    used_numbers.add(number)
                    break  # Берём первый подходящий шаблон для каждого числа

        return achievements[:3]  # Максимум 3 достижения

    def _extract_qualities(self, text: str) -> list[str]:
        """Извлечь качественные характеристики."""
        qualities = []

        quality_map = {
            "высоконагружен": "высоконагруженные системы",
            "масштабир": "масштабируемые решения",
            "микросервис": "микросервисная архитектура",
            "автоматизир": "автоматизация процессов",
            "enterprise": "enterprise-решения",
            "стартап": "стартап-среда",
            "продукт": "продуктовая разработка",
            "команд": "работа в команде",
        }

        for keyword, quality in quality_map.items():
            if keyword in text:
                qualities.append(quality)

        return qualities[:2]

    def _build_presentation(
        self,
        name: str,
        role: str,
        skills: list[str],
        achievements: list[str],
        qualities: list[str],
    ) -> str:
        """Собрать финальную презентацию."""
        import random

        parts = []

        # Приветствие с именем
        if name:
            parts.append(f"{name} —")

        # Основная роль и навыки
        if skills:
            template = random.choice(
                self.ROLE_TEMPLATES.get(role, self.ROLE_TEMPLATES["general"])
            )
            skills_text = ", ".join(skills[:3])
            if len(skills) > 3:
                skills_text += f" и {skills[3]}"
            parts.append(template.format(skills=skills_text))

        # Качества (с правильной грамматикой)
        if qualities:
            # Склонение: "Опыт работы с..." или "Специализация на..."
            quality = qualities[0]
            if any(q in quality for q in ["системы", "решения", "архитектура"]):
                parts.append(f"Специализация: {quality}.")
            else:
                parts.append(f"Опыт: {quality}.")

        # Достижения
        if achievements:
            if len(achievements) == 1:
                parts.append(f"Ключевое достижение: {achievements[0]}.")
            else:
                achievement_text = ", ".join(achievements[:2])
                parts.append(f"Достижения: {achievement_text}.")

        # Собираем текст
        if len(parts) <= 1:
            # Если мало информации, создаём базовое описание
            if name:
                return f"{name} — профессионал своего дела, открытый к новым проектам и сотрудничеству."
            return (
                "Профессионал своего дела, открытый к новым проектам и сотрудничеству."
            )

        # Объединяем части
        result = " ".join(parts)

        # Добавляем заключение
        endings = [
            " Открыт к интересным проектам.",
            " Готов к новым вызовам.",
            " Всегда в поиске интересных задач.",
        ]
        result += random.choice(endings)

        return result
