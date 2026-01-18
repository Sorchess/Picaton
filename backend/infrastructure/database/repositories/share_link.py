"""MongoDB реализация репозитория ссылок для шаринга."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.entities.share_link import ShareLink
from domain.repositories.share_link import ShareLinkRepositoryInterface


class MongoShareLinkRepository(ShareLinkRepositoryInterface):
    """MongoDB реализация репозитория ссылок для шаринга."""

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    def _to_document(self, link: ShareLink) -> dict:
        """Преобразовать сущность в документ MongoDB."""
        return {
            "_id": str(link.id),
            "card_id": str(link.card_id),
            "token": link.token,
            "created_at": link.created_at,
            "expires_at": link.expires_at,
            "is_active": link.is_active,
            "views_count": link.views_count,
        }

    def _from_document(self, doc: dict) -> ShareLink:
        """Преобразовать документ MongoDB в сущность."""
        return ShareLink(
            id=UUID(doc["_id"]),
            card_id=UUID(doc["card_id"]),
            token=doc["token"],
            created_at=doc.get("created_at", datetime.utcnow()),
            expires_at=doc.get("expires_at"),
            is_active=doc.get("is_active", True),
            views_count=doc.get("views_count", 0),
        )

    async def get_by_id(self, link_id: UUID) -> Optional[ShareLink]:
        """Получить ссылку по ID."""
        doc = await self._collection.find_one({"_id": str(link_id)})
        return self._from_document(doc) if doc else None

    async def get_by_token(self, token: str) -> Optional[ShareLink]:
        """Получить ссылку по токену."""
        doc = await self._collection.find_one({"token": token})
        return self._from_document(doc) if doc else None

    async def get_by_card_id(self, card_id: UUID) -> list[ShareLink]:
        """Получить все ссылки для визитки."""
        cursor = self._collection.find({"card_id": str(card_id)})
        docs = await cursor.to_list(length=100)
        return [self._from_document(doc) for doc in docs]

    async def create(self, link: ShareLink) -> ShareLink:
        """Создать ссылку."""
        doc = self._to_document(link)
        await self._collection.insert_one(doc)
        return link

    async def update(self, link: ShareLink) -> ShareLink:
        """Обновить ссылку."""
        doc = self._to_document(link)
        await self._collection.replace_one({"_id": str(link.id)}, doc)
        return link

    async def delete(self, link_id: UUID) -> bool:
        """Удалить ссылку."""
        result = await self._collection.delete_one({"_id": str(link_id)})
        return result.deleted_count > 0

    async def increment_views(self, link_id: UUID) -> bool:
        """Увеличить счетчик просмотров."""
        result = await self._collection.update_one(
            {"_id": str(link_id)}, {"$inc": {"views_count": 1}}
        )
        return result.modified_count > 0

    async def deactivate_expired(self) -> int:
        """Деактивировать истекшие ссылки."""
        now = datetime.utcnow()
        result = await self._collection.update_many(
            {"expires_at": {"$lt": now, "$ne": None}, "is_active": True},
            {"$set": {"is_active": False}},
        )
        return result.modified_count
