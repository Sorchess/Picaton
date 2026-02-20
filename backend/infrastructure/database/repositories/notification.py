"""MongoDB реализация репозитория уведомлений."""

from datetime import datetime
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.entities.notification import Notification
from domain.repositories.notification import NotificationRepositoryInterface


class MongoNotificationRepository(NotificationRepositoryInterface):
    """MongoDB реализация репозитория уведомлений."""

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    def _to_document(self, notification: Notification) -> dict:
        """Преобразовать сущность в документ MongoDB."""
        return {
            "_id": str(notification.id),
            "user_id": str(notification.user_id),
            "type": notification.type,
            "title": notification.title,
            "message": notification.message,
            "is_read": notification.is_read,
            "actor_id": str(notification.actor_id) if notification.actor_id else None,
            "actor_name": notification.actor_name,
            "actor_avatar_url": notification.actor_avatar_url,
            "data": notification.data,
            "created_at": notification.created_at,
        }

    def _from_document(self, doc: dict) -> Notification:
        """Преобразовать документ MongoDB в сущность."""
        return Notification(
            id=UUID(doc["_id"]),
            user_id=UUID(doc["user_id"]),
            type=doc["type"],
            title=doc["title"],
            message=doc["message"],
            is_read=doc.get("is_read", False),
            actor_id=UUID(doc["actor_id"]) if doc.get("actor_id") else None,
            actor_name=doc.get("actor_name"),
            actor_avatar_url=doc.get("actor_avatar_url"),
            data=doc.get("data", {}),
            created_at=doc.get("created_at", datetime.utcnow()),
        )

    async def create(self, notification: Notification) -> Notification:
        doc = self._to_document(notification)
        await self._collection.insert_one(doc)
        return notification

    async def get_by_user(
        self, user_id: UUID, skip: int = 0, limit: int = 50
    ) -> list[Notification]:
        cursor = (
            self._collection.find({"user_id": str(user_id)})
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )
        notifications = []
        async for doc in cursor:
            notifications.append(self._from_document(doc))
        return notifications

    async def mark_as_read(self, notification_id: UUID) -> bool:
        result = await self._collection.update_one(
            {"_id": str(notification_id)},
            {"$set": {"is_read": True}},
        )
        return result.modified_count > 0

    async def mark_all_as_read(self, user_id: UUID) -> int:
        result = await self._collection.update_many(
            {"user_id": str(user_id), "is_read": False},
            {"$set": {"is_read": True}},
        )
        return result.modified_count

    async def get_unread_count(self, user_id: UUID) -> int:
        return await self._collection.count_documents(
            {"user_id": str(user_id), "is_read": False}
        )

    async def exists(self, user_id: UUID, type: str, actor_id: UUID) -> bool:
        doc = await self._collection.find_one(
            {
                "user_id": str(user_id),
                "type": type,
                "actor_id": str(actor_id),
            }
        )
        return doc is not None
