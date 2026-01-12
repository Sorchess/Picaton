"""MongoDB реализация репозитория геймификации."""

from datetime import datetime, timezone
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection, AsyncIOMotorDatabase

from domain.entities.gamification import UserGamification
from domain.repositories.gamification import GamificationRepositoryInterface


class MongoGamificationRepository(GamificationRepositoryInterface):
    """MongoDB реализация репозитория геймификации."""

    def __init__(
        self,
        collection: AsyncIOMotorCollection,
        db: AsyncIOMotorDatabase,
    ):
        self._collection = collection
        self._db = db

    def _to_document(self, gamification: UserGamification) -> dict:
        """Преобразовать сущность в документ MongoDB."""
        return {
            "_id": str(gamification.id),
            "user_id": str(gamification.user_id),
            "total_points": gamification.total_points,
            "weekly_points": gamification.weekly_points,
            "monthly_points": gamification.monthly_points,
            "level": gamification.level,
            "badges": gamification.badges,
            "badges_earned_at": gamification.badges_earned_at,
            "current_voting_streak": gamification.current_voting_streak,
            "max_voting_streak": gamification.max_voting_streak,
            "last_vote_date": gamification.last_vote_date,
            "ideas_count": gamification.ideas_count,
            "swipes_count": gamification.swipes_count,
            "projects_count": gamification.projects_count,
            "completed_projects_count": gamification.completed_projects_count,
            "chat_messages_count": gamification.chat_messages_count,
            "reputation": gamification.reputation,
            "created_at": gamification.created_at,
            "updated_at": gamification.updated_at,
        }

    def _from_document(self, doc: dict) -> UserGamification:
        """Преобразовать документ MongoDB в сущность."""
        return UserGamification(
            id=UUID(doc["_id"]),
            user_id=UUID(doc["user_id"]),
            total_points=doc.get("total_points", 0),
            weekly_points=doc.get("weekly_points", 0),
            monthly_points=doc.get("monthly_points", 0),
            level=doc.get("level", 1),
            badges=doc.get("badges", []),
            badges_earned_at=doc.get("badges_earned_at", {}),
            current_voting_streak=doc.get("current_voting_streak", 0),
            max_voting_streak=doc.get("max_voting_streak", 0),
            last_vote_date=doc.get("last_vote_date"),
            ideas_count=doc.get("ideas_count", 0),
            swipes_count=doc.get("swipes_count", 0),
            projects_count=doc.get("projects_count", 0),
            completed_projects_count=doc.get("completed_projects_count", 0),
            chat_messages_count=doc.get("chat_messages_count", 0),
            reputation=doc.get("reputation", 0.5),
            created_at=doc.get("created_at", datetime.now(timezone.utc)),
            updated_at=doc.get("updated_at", datetime.now(timezone.utc)),
        )

    async def create(self, gamification: UserGamification) -> UserGamification:
        """Создать запись геймификации."""
        doc = self._to_document(gamification)
        await self._collection.insert_one(doc)
        return gamification

    async def get_by_id(self, gamification_id: UUID) -> UserGamification | None:
        """Получить по ID."""
        doc = await self._collection.find_one({"_id": str(gamification_id)})
        return self._from_document(doc) if doc else None

    async def get_by_user(self, user_id: UUID) -> UserGamification | None:
        """Получить по ID пользователя."""
        doc = await self._collection.find_one({"user_id": str(user_id)})
        return self._from_document(doc) if doc else None

    async def update(self, gamification: UserGamification) -> UserGamification:
        """Обновить запись."""
        doc = self._to_document(gamification)
        await self._collection.replace_one({"_id": str(gamification.id)}, doc)
        return gamification

    async def get_leaderboard(
        self,
        period: str = "all",  # "all" | "weekly" | "monthly"
        company_id: UUID | None = None,
        department_id: UUID | None = None,
        limit: int = 10,
    ) -> list[dict]:
        """
        Получить таблицу лидеров.
        Возвращает list of dicts с полями:
        - user_id, display_name, avatar_url, points, level, badges_count, rank
        """
        # Определяем поле для сортировки
        points_field = "total_points"
        if period == "weekly":
            points_field = "weekly_points"
        elif period == "monthly":
            points_field = "monthly_points"

        # Агрегация с join на users и business_cards
        pipeline = [
            {"$sort": {points_field: -1}},
            {"$limit": limit},
            {
                "$lookup": {
                    "from": "users",
                    "let": {"user_id": "$user_id"},
                    "pipeline": [
                        {"$match": {"$expr": {"$eq": ["$_id", "$$user_id"]}}},
                        {"$project": {"email": 1}},
                    ],
                    "as": "user",
                }
            },
            {
                "$lookup": {
                    "from": "business_cards",
                    "let": {"user_id": "$user_id"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {"$eq": ["$owner_id", "$$user_id"]},
                                "is_primary": True,
                            }
                        },
                        {"$project": {"display_name": 1, "avatar_url": 1}},
                    ],
                    "as": "card",
                }
            },
            {
                "$project": {
                    "user_id": 1,
                    "points": f"${points_field}",
                    "level": 1,
                    "badges_count": {"$size": "$badges"},
                    "display_name": {
                        "$ifNull": [
                            {"$arrayElemAt": ["$card.display_name", 0]},
                            {"$arrayElemAt": ["$user.email", 0]},
                        ]
                    },
                    "avatar_url": {"$arrayElemAt": ["$card.avatar_url", 0]},
                }
            },
        ]

        # Добавляем фильтр по компании если нужно
        if company_id:
            # Нужно сначала отфильтровать пользователей компании
            pipeline.insert(
                0,
                {
                    "$lookup": {
                        "from": "company_roles",
                        "let": {"user_id": "$user_id"},
                        "pipeline": [
                            {
                                "$match": {
                                    "$expr": {"$eq": ["$user_id", "$$user_id"]},
                                    "company_id": str(company_id),
                                }
                            }
                        ],
                        "as": "company_role",
                    }
                },
            )
            pipeline.insert(
                1,
                {"$match": {"company_role": {"$ne": []}}},
            )

        results = []
        rank = 1
        async for doc in self._collection.aggregate(pipeline):
            results.append(
                {
                    "user_id": UUID(doc["user_id"]),
                    "display_name": doc.get("display_name", "Unknown"),
                    "avatar_url": doc.get("avatar_url"),
                    "points": doc.get("points", 0),
                    "level": doc.get("level", 1),
                    "badges_count": doc.get("badges_count", 0),
                    "rank": rank,
                }
            )
            rank += 1

        return results

    async def reset_weekly_points(self) -> int:
        """Сбросить недельные очки для всех. Возвращает количество обновлённых."""
        result = await self._collection.update_many(
            {},
            {
                "$set": {
                    "weekly_points": 0,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        return result.modified_count

    async def reset_monthly_points(self) -> int:
        """Сбросить месячные очки для всех. Возвращает количество обновлённых."""
        result = await self._collection.update_many(
            {},
            {
                "$set": {
                    "monthly_points": 0,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        return result.modified_count
