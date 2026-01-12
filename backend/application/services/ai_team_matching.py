"""AI-сервис для матчинга экспертов под идею."""

import logging
from dataclasses import dataclass
from uuid import UUID

from domain.entities.idea import Idea
from domain.entities.user import User
from domain.entities.business_card import BusinessCard
from domain.repositories.business_card import BusinessCardRepositoryInterface
from domain.repositories.user import UserRepositoryInterface
from infrastructure.llm.gigachat_client import GigaChatClient
from infrastructure.llm.embedding_service import EmbeddingService


logger = logging.getLogger(__name__)


# Промпт для анализа идеи и извлечения требуемых навыков
IDEA_ANALYSIS_PROMPT = """Ты - эксперт по формированию команд и анализу проектов. Твоя задача - проанализировать идею проекта и определить, какие специалисты и навыки нужны для её реализации.

Правила:
1. Верни JSON объект с полями:
   - "skills": массив строк с конкретными техническими и софт-скиллами (5-15 навыков)
   - "roles": массив строк с названиями ролей/профессий (3-7 ролей)
   - "priority": массив из 3 наиболее критичных навыков
2. Навыки должны быть конкретными и актуальными
3. Включай как hard skills, так и soft skills
4. Учитывай масштаб и сложность идеи
5. Отвечай ТОЛЬКО JSON, без пояснений

Пример:
Идея: "Мобильное приложение для доставки еды с AI-рекомендациями"
Ответ: {
  "skills": ["swift", "kotlin", "react native", "python", "машинное обучение", "рекомендательные системы", "api разработка", "ui/ux дизайн", "работа с геолокацией", "интеграция платёжных систем"],
  "roles": ["iOS разработчик", "Android разработчик", "Backend разработчик", "ML Engineer", "UI/UX дизайнер", "Product Manager"],
  "priority": ["react native", "python", "машинное обучение"]
}
"""


@dataclass
class MatchedExpert:
    """Подобранный эксперт."""

    user_id: UUID
    card_id: UUID
    display_name: str
    avatar_url: str | None
    bio: str | None
    matching_skills: list[str]
    all_skills: list[str]
    match_score: float  # 0.0 - 1.0


@dataclass
class IdeaAnalysis:
    """Результат анализа идеи."""

    skills: list[str]
    roles: list[str]
    priority_skills: list[str]


@dataclass
class TeamSuggestion:
    """Предложение по составу команды."""

    experts: list[MatchedExpert]
    coverage: dict[str, list[str]]  # skill → list of expert names
    missing_skills: list[str]
    team_score: float  # 0.0 - 1.0


class AITeamMatchingService:
    """
    AI-сервис для матчинга экспертов под идею.
    Использует LLM для анализа идей и поиска подходящих специалистов.
    """

    def __init__(
        self,
        gigachat_client: GigaChatClient,
        embedding_service: EmbeddingService,
        card_repository: BusinessCardRepositoryInterface,
        user_repository: UserRepositoryInterface,
    ):
        self._gigachat = gigachat_client
        self._embedding = embedding_service
        self._card_repo = card_repository
        self._user_repo = user_repository

    async def analyze_idea(self, idea: Idea) -> IdeaAnalysis:
        """
        Анализировать идею и определить требуемые навыки.
        """
        if not self._gigachat.is_configured:
            # Fallback на ручные навыки
            return IdeaAnalysis(
                skills=idea.required_skills,
                roles=[],
                priority_skills=idea.required_skills[:3],
            )

        prompt = f"""Идея: "{idea.title}"

Описание: {idea.description}

Указанные навыки: {", ".join(idea.required_skills) if idea.required_skills else "не указаны"}
"""

        try:
            response = await self._gigachat.complete(
                system_prompt=IDEA_ANALYSIS_PROMPT,
                user_prompt=prompt,
                max_tokens=500,
                temperature=0.3,
            )

            import json

            data = json.loads(response.content)

            return IdeaAnalysis(
                skills=data.get("skills", idea.required_skills),
                roles=data.get("roles", []),
                priority_skills=data.get("priority", idea.required_skills[:3]),
            )
        except Exception as e:
            logger.warning(f"Failed to analyze idea with AI: {e}")
            return IdeaAnalysis(
                skills=idea.required_skills,
                roles=[],
                priority_skills=idea.required_skills[:3],
            )

    async def find_matching_experts(
        self,
        idea: Idea,
        limit: int = 20,
        exclude_user_id: UUID | None = None,
    ) -> list[MatchedExpert]:
        """
        Найти подходящих экспертов для реализации идеи.
        """
        # Получаем анализ идеи
        analysis = await self.analyze_idea(idea)
        all_skills = set(analysis.skills)
        all_skills.update(idea.required_skills)
        all_skills.update(idea.ai_suggested_skills)

        skills_list = list(all_skills)

        if not skills_list:
            return []

        # Ищем карточки по навыкам
        cards = await self._card_repo.search_by_tags(skills_list, limit * 2)

        # Если мало результатов, добавляем поиск по bio
        if len(cards) < limit:
            bio_cards = await self._card_repo.search_by_bio_keywords(skills_list, limit)
            existing_ids = {c.id for c in cards}
            for card in bio_cards:
                if card.id not in existing_ids:
                    cards.append(card)

        # Фильтруем и считаем score
        experts = []
        for card in cards:
            # Исключаем указанного пользователя (обычно автор идеи)
            if exclude_user_id and card.owner_id == exclude_user_id:
                continue

            # Считаем совпадающие навыки
            card_skills = set(s.lower() for s in card.search_tags)
            card_skills.update(t.name.lower() for t in card.tags)

            matching = skills_list_lower = [s.lower() for s in skills_list]
            matching_skills = [s for s in card_skills if s in skills_list_lower]

            if not matching_skills:
                continue

            # Считаем score
            score = len(matching_skills) / len(skills_list) if skills_list else 0

            # Бонус за priority skills
            priority_lower = [s.lower() for s in analysis.priority_skills]
            priority_matches = sum(1 for s in matching_skills if s in priority_lower)
            if priority_matches > 0:
                score += 0.1 * priority_matches

            score = min(score, 1.0)

            experts.append(
                MatchedExpert(
                    user_id=card.owner_id,
                    card_id=card.id,
                    display_name=card.display_name,
                    avatar_url=card.avatar_url,
                    bio=card.ai_generated_bio or card.bio,
                    matching_skills=matching_skills,
                    all_skills=list(card_skills),
                    match_score=score,
                )
            )

        # Сортируем по score
        experts.sort(key=lambda x: x.match_score, reverse=True)

        return experts[:limit]

    async def calculate_match_score(
        self,
        idea: Idea,
        user_id: UUID,
    ) -> float:
        """
        Рассчитать процент совпадения пользователя с требованиями идеи.
        """
        # Получаем все карточки пользователя
        cards = await self._card_repo.get_by_owner(user_id)
        if not cards:
            return 0.0

        # Получаем все навыки пользователя
        user_skills = set()
        for card in cards:
            user_skills.update(s.lower() for s in card.search_tags)
            user_skills.update(t.name.lower() for t in card.tags)

        # Получаем требуемые навыки
        analysis = await self.analyze_idea(idea)
        required_skills = set(s.lower() for s in analysis.skills)
        required_skills.update(s.lower() for s in idea.required_skills)

        if not required_skills:
            return 0.0

        # Считаем совпадение
        matching = user_skills & required_skills
        score = len(matching) / len(required_skills)

        return min(score, 1.0)

    async def suggest_team(
        self,
        idea: Idea,
        max_team_size: int = 5,
    ) -> TeamSuggestion:
        """
        Предложить оптимальный состав команды для идеи.
        Пытается покрыть как можно больше навыков минимальным количеством людей.
        """
        analysis = await self.analyze_idea(idea)
        required_skills = set(s.lower() for s in analysis.skills)
        required_skills.update(s.lower() for s in idea.required_skills)

        # Получаем кандидатов
        all_experts = await self.find_matching_experts(
            idea=idea,
            limit=50,
            exclude_user_id=idea.author_id,
        )

        if not all_experts:
            return TeamSuggestion(
                experts=[],
                coverage={},
                missing_skills=list(required_skills),
                team_score=0.0,
            )

        # Жадный алгоритм покрытия навыков
        team = []
        covered_skills = set()
        coverage = {}

        for _ in range(max_team_size):
            if covered_skills >= required_skills:
                break

            # Находим эксперта, который покроет больше всего непокрытых навыков
            best_expert = None
            best_new_coverage = 0

            for expert in all_experts:
                if expert in team:
                    continue

                expert_skills = set(s.lower() for s in expert.matching_skills)
                new_coverage = len(expert_skills - covered_skills)

                if new_coverage > best_new_coverage:
                    best_new_coverage = new_coverage
                    best_expert = expert

            if best_expert and best_new_coverage > 0:
                team.append(best_expert)
                for skill in best_expert.matching_skills:
                    skill_lower = skill.lower()
                    covered_skills.add(skill_lower)
                    if skill_lower not in coverage:
                        coverage[skill_lower] = []
                    coverage[skill_lower].append(best_expert.display_name)
            else:
                break

        missing = list(required_skills - covered_skills)
        team_score = (
            len(covered_skills) / len(required_skills) if required_skills else 0
        )

        return TeamSuggestion(
            experts=team,
            coverage=coverage,
            missing_skills=missing,
            team_score=team_score,
        )
