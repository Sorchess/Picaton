"""MongoDB реализация репозитория свайпов на идеи."""

from datetime import datetime, timezone
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.entities.idea_swipe import IdeaSwipe
from domain.enums.idea import SwipeDirection
from domain.repositories.idea_swipe import IdeaSwipeRepositoryInterface


class MongoIdeaSwipeRepository(IdeaSwipeRepositoryInterface):
    """MongoDB реализация репозитория свайпов."""

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    def _to_document(self, swipe: IdeaSwipe) -> dict:
        """Преобразовать сущность в документ MongoDB."""
        return {
            "_id": str(swipe.id),
            "user_id": str(swipe.user_id),
            "idea_id": str(swipe.idea_id),
            "direction": swipe.direction.value,
            "created_at": swipe.created_at,
        }

    def _from_document(self, doc: dict) -> IdeaSwipe:
        """Преобразовать документ MongoDB в сущность."""
        return IdeaSwipe(
            id=UUID(doc["_id"]),
            user_id=UUID(doc["user_id"]),
            idea_id=UUID(doc["idea_id"]),
            direction=SwipeDirection(doc.get("direction", "like")),
            created_at=doc.get("created_at", datetime.now(timezone.utc)),
        )

    async def create(self, swipe: IdeaSwipe) -> IdeaSwipe:
        """Создать свайп."""
        doc = self._to_document(swipe)
        await self._collection.insert_one(doc)
        return swipe

    async def get_by_id(self, swipe_id: UUID) -> IdeaSwipe | None:
        """Получить свайп по ID."""
        doc = await self._collection.find_one({"_id": str(swipe_id)})
        return self._from_document(doc) if doc else None

    async def get_by_user_and_idea(
        self,
        user_id: UUID,
        idea_id: UUID,
    ) -> IdeaSwipe | None:
        """Получить свайп пользователя на идею."""
        doc = await self._collection.find_one(
            {
                "user_id": str(user_id),
                "idea_id": str(idea_id),
            }
        )
        return self._from_document(doc) if doc else None

    async def get_swiped_idea_ids(self, user_id: UUID) -> set[UUID]:
        """Получить ID идей, которые пользователь уже свайпнул."""
        cursor = self._collection.find(
            {"user_id": str(user_id)},
            {"idea_id": 1},
        )
        return {UUID(doc["idea_id"]) async for doc in cursor}

    async def get_likes_for_idea(
        self,
        idea_id: UUID,
        include_super: bool = True,
    ) -> list[IdeaSwipe]:
        """Получить лайки на идею."""
        directions = [SwipeDirection.LIKE.value]
        if include_super:
            directions.append(SwipeDirection.SUPER_LIKE.value)

        cursor = self._collection.find(
            {
                "idea_id": str(idea_id),
                "direction": {"$in": directions},
            }
        ).sort("created_at", -1)

        return [self._from_document(doc) async for doc in cursor]

    async def get_user_likes(
        self,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> list[IdeaSwipe]:
        """Получить лайки пользователя."""
        cursor = (
            self._collection.find(
                {
                    "user_id": str(user_id),
                    "direction": {
                        "$in": [
                            SwipeDirection.LIKE.value,
                            SwipeDirection.SUPER_LIKE.value,
                        ]
                    },
                }
            )
            .sort("created_at", -1)
            .skip(offset)
            .limit(limit)
        )
        return [self._from_document(doc) async for doc in cursor]

    async def get_matches_for_idea(
        self,
        idea_id: UUID,
        author_id: UUID,
    ) -> list[UUID]:
        """
        Получить взаимные мэтчи для идеи.
        Пользователи которые лайкнули эту идею И автор лайкнул их идеи.
        """
        # Шаг 1: Получить user_id всех кто лайкнул эту идею
        pipeline = [
            {
                "$match": {
                    "idea_id": str(idea_id),
                    "direction": {
                        "$in": [
                            SwipeDirection.LIKE.value,
                            SwipeDirection.SUPER_LIKE.value,
                        ]
                    },
                }
            },
            {
                "$lookup": {
                    "from": "ideas",
                    "localField": "user_id",
                    "foreignField": "author_id",
                    "as": "user_ideas",
                }
            },
            {"$unwind": "$user_ideas"},
            {
                "$lookup": {
                    "from": "idea_swipes",
                    "let": {"user_idea_id": "$user_ideas._id"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$and": [
                                        {"$eq": ["$idea_id", "$$user_idea_id"]},
                                        {"$eq": ["$user_id", str(author_id)]},
                                        {
                                            "$in": [
                                                "$direction",
                                                [
                                                    SwipeDirection.LIKE.value,
                                                    SwipeDirection.SUPER_LIKE.value,
                                                ],
                                            ]
                                        },
                                    ]
                                }
                            }
                        }
                    ],
                    "as": "author_likes",
                }
            },
            {"$match": {"author_likes": {"$ne": []}}},
            {"$group": {"_id": "$user_id"}},
        ]

        cursor = self._collection.aggregate(pipeline)
        return [UUID(doc["_id"]) async for doc in cursor]

    async def count_likes_for_idea(
        self,
        idea_id: UUID,
        direction: SwipeDirection | None = None,
    ) -> int:
        """Подсчитать лайки на идею."""
        query = {"idea_id": str(idea_id)}
        if direction:
            query["direction"] = direction.value
        else:
            query["direction"] = {
                "$in": [SwipeDirection.LIKE.value, SwipeDirection.SUPER_LIKE.value]
            }

        return await self._collection.count_documents(query)

    async def delete_by_user_and_idea(
        self,
        user_id: UUID,
        idea_id: UUID,
    ) -> bool:
        """Удалить свайп (отменить лайк)."""
        result = await self._collection.delete_one(
            {
                "user_id": str(user_id),
                "idea_id": str(idea_id),
            }
        )
        return result.deleted_count > 0

    async def get_users_who_liked_my_ideas(
        self,
        author_id: UUID,
        limit: int = 50,
    ) -> list[tuple[UUID, UUID]]:
        """Получить пользователей, лайкнувших идеи автора."""
        pipeline = [
            {
                "$lookup": {
                    "from": "ideas",
                    "localField": "idea_id",
                    "foreignField": "_id",
                    "as": "idea",
                }
            },
            {"$unwind": "$idea"},
            {
                "$match": {
                    "idea.author_id": str(author_id),
                    "direction": {
                        "$in": [
                            SwipeDirection.LIKE.value,
                            SwipeDirection.SUPER_LIKE.value,
                        ]
                    },
                }
            },
            {"$sort": {"created_at": -1}},
            {"$limit": limit},
            {
                "$project": {
                    "user_id": 1,
                    "idea_id": 1,
                }
            },
        ]

        cursor = self._collection.aggregate(pipeline)
        return [(UUID(doc["user_id"]), UUID(doc["idea_id"])) async for doc in cursor]
