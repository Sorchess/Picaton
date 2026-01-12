"""MongoDB реализация репозитория идей."""

from datetime import datetime, timezone
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.entities.idea import Idea
from domain.enums.idea import IdeaStatus, IdeaVisibility
from domain.repositories.idea import IdeaRepositoryInterface


class MongoIdeaRepository(IdeaRepositoryInterface):
    """MongoDB реализация репозитория идей."""

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    def _to_document(self, idea: Idea) -> dict:
        """Преобразовать сущность в документ MongoDB."""
        return {
            "_id": str(idea.id),
            "author_id": str(idea.author_id),
            "title": idea.title,
            "description": idea.description,
            # PRD поля
            "problem_statement": idea.problem_statement,
            "solution_description": idea.solution_description,
            "target_users": idea.target_users,
            "mvp_scope": idea.mvp_scope,
            "success_metrics": idea.success_metrics,
            "risks": idea.risks,
            "timeline": idea.timeline,
            # Навыки
            "required_skills": idea.required_skills,
            "ai_suggested_skills": idea.ai_suggested_skills,
            "ai_suggested_roles": idea.ai_suggested_roles,
            # Статус и видимость
            "status": idea.status.value,
            "visibility": idea.visibility.value,
            # Связи
            "company_id": str(idea.company_id) if idea.company_id else None,
            "department_id": str(idea.department_id) if idea.department_id else None,
            # AI флаги
            "prd_generated_by_ai": idea.prd_generated_by_ai,
            "skills_confidence": idea.skills_confidence,
            # Embedding
            "embedding": idea.embedding,
            # Статистика
            "likes_count": idea.likes_count,
            "super_likes_count": idea.super_likes_count,
            "dislikes_count": idea.dislikes_count,
            "views_count": idea.views_count,
            "comments_count": idea.comments_count,
            "engagement_time_seconds": idea.engagement_time_seconds,
            # Score
            "idea_score": idea.idea_score,
            "score_updated_at": idea.score_updated_at,
            # Gamification
            "points_awarded": idea.points_awarded,
            # Timestamps
            "created_at": idea.created_at,
            "updated_at": idea.updated_at,
            "published_at": idea.published_at,
        }

    def _from_document(self, doc: dict) -> Idea:
        """Преобразовать документ MongoDB в сущность."""
        return Idea(
            id=UUID(doc["_id"]),
            author_id=UUID(doc["author_id"]),
            title=doc.get("title", ""),
            description=doc.get("description", ""),
            # PRD поля
            problem_statement=doc.get("problem_statement", ""),
            solution_description=doc.get("solution_description", ""),
            target_users=doc.get("target_users", ""),
            mvp_scope=doc.get("mvp_scope", ""),
            success_metrics=doc.get("success_metrics", ""),
            risks=doc.get("risks", ""),
            timeline=doc.get("timeline", ""),
            # Навыки
            required_skills=doc.get("required_skills", []),
            ai_suggested_skills=doc.get("ai_suggested_skills", []),
            ai_suggested_roles=doc.get("ai_suggested_roles", []),
            # Статус и видимость
            status=IdeaStatus(doc.get("status", "draft")),
            visibility=IdeaVisibility(doc.get("visibility", "public")),
            # Связи
            company_id=UUID(doc["company_id"]) if doc.get("company_id") else None,
            department_id=(
                UUID(doc["department_id"]) if doc.get("department_id") else None
            ),
            # AI флаги
            prd_generated_by_ai=doc.get("prd_generated_by_ai", False),
            skills_confidence=doc.get("skills_confidence", 0.0),
            # Embedding
            embedding=doc.get("embedding", []),
            # Статистика
            likes_count=doc.get("likes_count", 0),
            super_likes_count=doc.get("super_likes_count", 0),
            dislikes_count=doc.get("dislikes_count", 0),
            views_count=doc.get("views_count", 0),
            comments_count=doc.get("comments_count", 0),
            engagement_time_seconds=doc.get("engagement_time_seconds", 0),
            # Score
            idea_score=doc.get("idea_score", 0.0),
            score_updated_at=doc.get("score_updated_at"),
            # Gamification
            points_awarded=doc.get("points_awarded", 0),
            # Timestamps
            created_at=doc.get("created_at", datetime.now(timezone.utc)),
            updated_at=doc.get("updated_at", datetime.now(timezone.utc)),
            published_at=doc.get("published_at"),
        )

    async def create(self, idea: Idea) -> Idea:
        """Создать идею."""
        doc = self._to_document(idea)
        await self._collection.insert_one(doc)
        return idea

    async def get_by_id(self, idea_id: UUID) -> Idea | None:
        """Получить идею по ID."""
        doc = await self._collection.find_one({"_id": str(idea_id)})
        return self._from_document(doc) if doc else None

    async def update(self, idea: Idea) -> Idea:
        """Обновить идею."""
        doc = self._to_document(idea)
        await self._collection.replace_one({"_id": str(idea.id)}, doc)
        return idea

    async def delete(self, idea_id: UUID) -> bool:
        """Удалить идею."""
        result = await self._collection.delete_one({"_id": str(idea_id)})
        return result.deleted_count > 0

    async def get_by_author(
        self,
        author_id: UUID,
        status: IdeaStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Idea]:
        """Получить идеи автора."""
        query = {"author_id": str(author_id)}
        if status:
            query["status"] = status.value

        cursor = (
            self._collection.find(query)
            .sort("created_at", -1)
            .skip(offset)
            .limit(limit)
        )
        return [self._from_document(doc) async for doc in cursor]

    async def get_active_ideas(
        self,
        exclude_author_id: UUID | None = None,
        exclude_idea_ids: set[UUID] | None = None,
        visibility: IdeaVisibility = IdeaVisibility.PUBLIC,
        company_id: UUID | None = None,
        limit: int = 20,
    ) -> list[Idea]:
        """Получить активные идеи для ленты свайпов."""
        query = {
            "status": {"$in": [IdeaStatus.ACTIVE.value, IdeaStatus.TEAM_FORMING.value]},
        }

        if visibility == IdeaVisibility.PUBLIC:
            query["visibility"] = IdeaVisibility.PUBLIC.value
        elif visibility == IdeaVisibility.COMPANY and company_id:
            query["visibility"] = IdeaVisibility.COMPANY.value
            query["company_id"] = str(company_id)

        if exclude_author_id:
            query["author_id"] = {"$ne": str(exclude_author_id)}

        if exclude_idea_ids:
            query["_id"] = {"$nin": [str(id) for id in exclude_idea_ids]}

        cursor = (
            self._collection.find(query)
            .sort([("super_likes_count", -1), ("likes_count", -1), ("created_at", -1)])
            .limit(limit)
        )
        return [self._from_document(doc) async for doc in cursor]

    async def search_by_skills(
        self,
        skills: list[str],
        limit: int = 20,
    ) -> list[Idea]:
        """Поиск идей по навыкам."""
        normalized_skills = [s.lower() for s in skills]
        query = {
            "status": {"$in": [IdeaStatus.ACTIVE.value, IdeaStatus.TEAM_FORMING.value]},
            "$or": [
                {"required_skills": {"$in": normalized_skills}},
                {"ai_suggested_skills": {"$in": normalized_skills}},
            ],
        }

        cursor = self._collection.find(query).limit(limit)
        return [self._from_document(doc) async for doc in cursor]

    async def search_by_text(
        self,
        query: str,
        limit: int = 20,
    ) -> list[Idea]:
        """Полнотекстовый поиск идей."""
        search_query = {
            "status": {"$in": [IdeaStatus.ACTIVE.value, IdeaStatus.TEAM_FORMING.value]},
            "$or": [
                {"title": {"$regex": query, "$options": "i"}},
                {"description": {"$regex": query, "$options": "i"}},
            ],
        }

        cursor = self._collection.find(search_query).limit(limit)
        return [self._from_document(doc) async for doc in cursor]

    async def search_by_embedding(
        self,
        embedding: list[float],
        limit: int = 20,
        min_score: float = 0.5,
    ) -> list[Idea]:
        """Семантический поиск идей по embedding."""
        # MongoDB Atlas Vector Search
        pipeline = [
            {
                "$vectorSearch": {
                    "index": "idea_embedding_index",
                    "path": "embedding",
                    "queryVector": embedding,
                    "numCandidates": limit * 10,
                    "limit": limit,
                }
            },
            {
                "$match": {
                    "status": {
                        "$in": [IdeaStatus.ACTIVE.value, IdeaStatus.TEAM_FORMING.value]
                    }
                }
            },
            {"$addFields": {"score": {"$meta": "vectorSearchScore"}}},
            {"$match": {"score": {"$gte": min_score}}},
        ]

        try:
            cursor = self._collection.aggregate(pipeline)
            return [self._from_document(doc) async for doc in cursor]
        except Exception:
            # Fallback если vector search не настроен
            return []

    async def increment_likes(
        self,
        idea_id: UUID,
        is_super: bool = False,
    ) -> None:
        """Увеличить счётчик лайков."""
        field = "super_likes_count" if is_super else "likes_count"
        await self._collection.update_one(
            {"_id": str(idea_id)},
            {
                "$inc": {field: 1},
                "$set": {"updated_at": datetime.now(timezone.utc)},
            },
        )

    async def increment_views(self, idea_id: UUID) -> None:
        """Увеличить счётчик просмотров."""
        await self._collection.update_one(
            {"_id": str(idea_id)},
            {"$inc": {"views_count": 1}},
        )

    async def increment_dislikes(self, idea_id: UUID) -> None:
        """Увеличить счётчик дизлайков."""
        await self._collection.update_one(
            {"_id": str(idea_id)},
            {"$inc": {"dislikes_count": 1}},
        )

    async def increment_comments(self, idea_id: UUID) -> None:
        """Увеличить счётчик комментариев."""
        await self._collection.update_one(
            {"_id": str(idea_id)},
            {
                "$inc": {"comments_count": 1},
                "$set": {"updated_at": datetime.now(timezone.utc)},
            },
        )

    async def add_engagement_time(self, idea_id: UUID, seconds: int) -> None:
        """Добавить время вовлечённости."""
        await self._collection.update_one(
            {"_id": str(idea_id)},
            {"$inc": {"engagement_time_seconds": seconds}},
        )

    async def update_score(self, idea_id: UUID, score: float) -> None:
        """Обновить IdeaScore."""
        await self._collection.update_one(
            {"_id": str(idea_id)},
            {
                "$set": {
                    "idea_score": score,
                    "score_updated_at": datetime.now(timezone.utc),
                }
            },
        )

    async def get_leaderboard(
        self,
        company_id: UUID | None = None,
        department_id: UUID | None = None,
        period_days: int | None = None,
        limit: int = 10,
    ) -> list[Idea]:
        """
        Получить топ идей (Leaderboard).

        Args:
            company_id: Фильтр по компании
            department_id: Фильтр по департаменту
            period_days: За последние N дней (None = all time)
            limit: Количество записей
        """
        query = {
            "status": {"$in": [IdeaStatus.ACTIVE.value, IdeaStatus.TEAM_FORMING.value]},
        }

        if company_id:
            query["company_id"] = str(company_id)
        if department_id:
            query["department_id"] = str(department_id)
        if period_days:
            from datetime import timedelta

            cutoff = datetime.now(timezone.utc) - timedelta(days=period_days)
            query["published_at"] = {"$gte": cutoff}

        cursor = self._collection.find(query).sort("idea_score", -1).limit(limit)
        return [self._from_document(doc) async for doc in cursor]

    async def recalculate_all_scores(self) -> int:
        """
        Пересчитать IdeaScore для всех активных идей.
        Возвращает количество обновлённых идей.
        Вызывается cron-ом.
        """
        query = {
            "status": {"$in": [IdeaStatus.ACTIVE.value, IdeaStatus.TEAM_FORMING.value]},
        }

        count = 0
        async for doc in self._collection.find(query):
            idea = self._from_document(doc)
            # Используем базовую репутацию 0.5 (можно интегрировать с gamification)
            new_score = idea.calculate_score(author_reputation=0.5)
            await self.update_score(idea.id, new_score)
            count += 1

        return count

    async def get_by_visibility(
        self,
        visibility: IdeaVisibility,
        company_id: UUID | None = None,
        department_id: UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Idea]:
        """Получить идеи по visibility с фильтрами."""
        query = {
            "status": {"$in": [IdeaStatus.ACTIVE.value, IdeaStatus.TEAM_FORMING.value]},
            "visibility": visibility.value,
        }

        if visibility == IdeaVisibility.COMPANY and company_id:
            query["company_id"] = str(company_id)
        elif visibility == IdeaVisibility.DEPARTMENT and department_id:
            query["department_id"] = str(department_id)

        cursor = (
            self._collection.find(query)
            .sort("idea_score", -1)
            .skip(offset)
            .limit(limit)
        )
        return [self._from_document(doc) async for doc in cursor]
