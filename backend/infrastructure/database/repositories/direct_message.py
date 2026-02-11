"""MongoDB реализация репозитория прямых сообщений."""

from datetime import datetime, timezone
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.entities.conversation import DirectMessage
from domain.repositories.direct_message import DirectMessageRepositoryInterface


class MongoDirectMessageRepository(DirectMessageRepositoryInterface):

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    def _to_document(self, msg: DirectMessage) -> dict:
        return {
            "_id": str(msg.id),
            "conversation_id": str(msg.conversation_id),
            "sender_id": str(msg.sender_id),
            "content": msg.content,
            "is_read": msg.is_read,
            "read_at": msg.read_at,
            "is_edited": msg.is_edited,
            "edited_at": msg.edited_at,
            "is_deleted": msg.is_deleted,
            "deleted_at": msg.deleted_at,
            "reply_to_id": str(msg.reply_to_id) if msg.reply_to_id else None,
            "created_at": msg.created_at,
        }

    def _from_document(self, doc: dict) -> DirectMessage:
        return DirectMessage(
            id=UUID(doc["_id"]),
            conversation_id=UUID(doc["conversation_id"]),
            sender_id=UUID(doc["sender_id"]),
            content=doc.get("content", ""),
            is_read=doc.get("is_read", False),
            read_at=doc.get("read_at"),
            is_edited=doc.get("is_edited", False),
            edited_at=doc.get("edited_at"),
            is_deleted=doc.get("is_deleted", False),
            deleted_at=doc.get("deleted_at"),
            reply_to_id=UUID(doc["reply_to_id"]) if doc.get("reply_to_id") else None,
            created_at=doc.get("created_at", datetime.now(timezone.utc)),
        )

    async def create(self, message: DirectMessage) -> DirectMessage:
        doc = self._to_document(message)
        await self._collection.insert_one(doc)
        return message

    async def get_by_id(self, message_id: UUID) -> DirectMessage | None:
        doc = await self._collection.find_one({"_id": str(message_id)})
        return self._from_document(doc) if doc else None

    async def update(self, message: DirectMessage) -> DirectMessage:
        doc = self._to_document(message)
        await self._collection.replace_one({"_id": str(message.id)}, doc)
        return message

    async def get_by_conversation(
        self,
        conversation_id: UUID,
        limit: int = 50,
        before: datetime | None = None,
    ) -> list[DirectMessage]:
        query: dict = {
            "conversation_id": str(conversation_id),
            "is_deleted": False,
        }
        if before:
            query["created_at"] = {"$lt": before}

        cursor = self._collection.find(query).sort("created_at", -1).limit(limit)
        messages = [self._from_document(doc) async for doc in cursor]
        return list(reversed(messages))

    async def mark_as_read(self, conversation_id: UUID, reader_id: UUID) -> int:
        result = await self._collection.update_many(
            {
                "conversation_id": str(conversation_id),
                "sender_id": {"$ne": str(reader_id)},
                "is_read": False,
                "is_deleted": False,
            },
            {
                "$set": {
                    "is_read": True,
                    "read_at": datetime.now(timezone.utc),
                }
            },
        )
        return result.modified_count

    async def get_unread_count(self, conversation_id: UUID, user_id: UUID) -> int:
        return await self._collection.count_documents(
            {
                "conversation_id": str(conversation_id),
                "sender_id": {"$ne": str(user_id)},
                "is_read": False,
                "is_deleted": False,
            }
        )

    async def get_total_unread_count(self, user_id: UUID) -> int:
        return await self._collection.count_documents(
            {
                "sender_id": {"$ne": str(user_id)},
                "is_read": False,
                "is_deleted": False,
            }
        )

    async def get_unread_counts_by_conversation(self, user_id: UUID) -> dict[UUID, int]:
        pipeline = [
            {
                "$match": {
                    "sender_id": {"$ne": str(user_id)},
                    "is_read": False,
                    "is_deleted": False,
                }
            },
            {"$group": {"_id": "$conversation_id", "count": {"$sum": 1}}},
        ]
        cursor = self._collection.aggregate(pipeline)
        result: dict[UUID, int] = {}
        async for doc in cursor:
            result[UUID(doc["_id"])] = doc["count"]
        return result

    async def soft_delete(self, message_id: UUID) -> bool:
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

    async def search_in_conversation(
        self, conversation_id: UUID, query: str, limit: int = 20
    ) -> list[DirectMessage]:
        search_query = {
            "conversation_id": str(conversation_id),
            "is_deleted": False,
            "content": {"$regex": query, "$options": "i"},
        }
        cursor = self._collection.find(search_query).sort("created_at", -1).limit(limit)
        return [self._from_document(doc) async for doc in cursor]
