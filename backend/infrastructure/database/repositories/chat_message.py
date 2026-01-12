"""MongoDB реализация репозитория сообщений чата."""

from datetime import datetime, timezone
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.entities.chat_message import ChatMessage
from domain.enums.project import MessageType
from domain.repositories.chat_message import ChatMessageRepositoryInterface


class MongoChatMessageRepository(ChatMessageRepositoryInterface):
    """MongoDB реализация репозитория сообщений чата."""

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    def _to_document(self, message: ChatMessage) -> dict:
        """Преобразовать сущность в документ MongoDB."""
        return {
            "_id": str(message.id),
            "project_id": str(message.project_id),
            "author_id": str(message.author_id) if message.author_id else None,
            "content": message.content,
            "message_type": message.message_type.value,
            "file_url": message.file_url,
            "file_name": message.file_name,
            "file_size": message.file_size,
            "reply_to_id": str(message.reply_to_id) if message.reply_to_id else None,
            "read_by": [str(uid) for uid in message.read_by],
            "is_edited": message.is_edited,
            "edited_at": message.edited_at,
            "is_deleted": message.is_deleted,
            "deleted_at": message.deleted_at,
            "created_at": message.created_at,
        }

    def _from_document(self, doc: dict) -> ChatMessage:
        """Преобразовать документ MongoDB в сущность."""
        return ChatMessage(
            id=UUID(doc["_id"]),
            project_id=UUID(doc["project_id"]),
            author_id=UUID(doc["author_id"]) if doc.get("author_id") else None,
            content=doc.get("content", ""),
            message_type=MessageType(doc.get("message_type", "text")),
            file_url=doc.get("file_url"),
            file_name=doc.get("file_name"),
            file_size=doc.get("file_size"),
            reply_to_id=UUID(doc["reply_to_id"]) if doc.get("reply_to_id") else None,
            read_by=[UUID(uid) for uid in doc.get("read_by", [])],
            is_edited=doc.get("is_edited", False),
            edited_at=doc.get("edited_at"),
            is_deleted=doc.get("is_deleted", False),
            deleted_at=doc.get("deleted_at"),
            created_at=doc.get("created_at", datetime.now(timezone.utc)),
        )

    async def create(self, message: ChatMessage) -> ChatMessage:
        """Создать сообщение."""
        doc = self._to_document(message)
        await self._collection.insert_one(doc)
        return message

    async def get_by_id(self, message_id: UUID) -> ChatMessage | None:
        """Получить сообщение по ID."""
        doc = await self._collection.find_one({"_id": str(message_id)})
        return self._from_document(doc) if doc else None

    async def update(self, message: ChatMessage) -> ChatMessage:
        """Обновить сообщение."""
        doc = self._to_document(message)
        await self._collection.replace_one({"_id": str(message.id)}, doc)
        return message

    async def delete(self, message_id: UUID) -> bool:
        """Удалить сообщение (hard delete)."""
        result = await self._collection.delete_one({"_id": str(message_id)})
        return result.deleted_count > 0

    async def get_by_project(
        self,
        project_id: UUID,
        limit: int = 50,
        before: datetime | None = None,
        after: datetime | None = None,
    ) -> list[ChatMessage]:
        """Получить сообщения проекта."""
        query = {
            "project_id": str(project_id),
            "is_deleted": False,
        }

        if before:
            query["created_at"] = {"$lt": before}
        elif after:
            query["created_at"] = {"$gt": after}

        cursor = self._collection.find(query).sort("created_at", -1).limit(limit)

        messages = [self._from_document(doc) async for doc in cursor]
        # Возвращаем в хронологическом порядке
        return list(reversed(messages))

    async def get_latest_message(
        self,
        project_id: UUID,
    ) -> ChatMessage | None:
        """Получить последнее сообщение в проекте."""
        doc = await self._collection.find_one(
            {"project_id": str(project_id), "is_deleted": False},
            sort=[("created_at", -1)],
        )
        return self._from_document(doc) if doc else None

    async def mark_as_read(
        self,
        project_id: UUID,
        user_id: UUID,
        until: datetime | None = None,
    ) -> int:
        """Отметить сообщения как прочитанные."""
        query = {
            "project_id": str(project_id),
            "read_by": {"$ne": str(user_id)},
        }
        if until:
            query["created_at"] = {"$lte": until}

        result = await self._collection.update_many(
            query,
            {"$addToSet": {"read_by": str(user_id)}},
        )
        return result.modified_count

    async def get_unread_count(
        self,
        project_id: UUID,
        user_id: UUID,
    ) -> int:
        """Получить количество непрочитанных сообщений."""
        return await self._collection.count_documents(
            {
                "project_id": str(project_id),
                "is_deleted": False,
                "author_id": {"$ne": str(user_id)},  # Свои сообщения не считаем
                "read_by": {"$ne": str(user_id)},
            }
        )

    async def get_unread_counts_for_user(
        self,
        user_id: UUID,
        project_ids: list[UUID],
    ) -> dict[UUID, int]:
        """Получить количество непрочитанных сообщений для списка проектов."""
        if not project_ids:
            return {}

        pipeline = [
            {
                "$match": {
                    "project_id": {"$in": [str(pid) for pid in project_ids]},
                    "is_deleted": False,
                    "author_id": {"$ne": str(user_id)},
                    "read_by": {"$ne": str(user_id)},
                }
            },
            {
                "$group": {
                    "_id": "$project_id",
                    "count": {"$sum": 1},
                }
            },
        ]

        cursor = self._collection.aggregate(pipeline)
        result = {}
        async for doc in cursor:
            result[UUID(doc["_id"])] = doc["count"]

        # Заполняем нулями проекты без непрочитанных
        for pid in project_ids:
            if pid not in result:
                result[pid] = 0

        return result

    async def count_by_project(self, project_id: UUID) -> int:
        """Подсчитать сообщения в проекте."""
        return await self._collection.count_documents(
            {
                "project_id": str(project_id),
                "is_deleted": False,
            }
        )

    async def soft_delete(self, message_id: UUID) -> bool:
        """Мягкое удаление сообщения."""
        result = await self._collection.update_one(
            {"_id": str(message_id)},
            {
                "$set": {
                    "is_deleted": True,
                    "deleted_at": datetime.now(timezone.utc),
                    "content": "",
                }
            },
        )
        return result.modified_count > 0

    async def search_in_project(
        self,
        project_id: UUID,
        query: str,
        limit: int = 20,
    ) -> list[ChatMessage]:
        """Поиск сообщений в проекте."""
        search_query = {
            "project_id": str(project_id),
            "is_deleted": False,
            "content": {"$regex": query, "$options": "i"},
        }

        cursor = self._collection.find(search_query).sort("created_at", -1).limit(limit)
        return [self._from_document(doc) async for doc in cursor]
