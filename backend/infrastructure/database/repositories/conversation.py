"""MongoDB реализация репозитория диалогов."""

from datetime import datetime, timezone
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.entities.conversation import Conversation
from domain.repositories.conversation import ConversationRepositoryInterface


class MongoConversationRepository(ConversationRepositoryInterface):

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    def _to_document(self, conv: Conversation) -> dict:
        return {
            "_id": str(conv.id),
            "participants": [str(p) for p in conv.participants],
            "last_message_content": conv.last_message_content,
            "last_message_sender_id": (
                str(conv.last_message_sender_id)
                if conv.last_message_sender_id
                else None
            ),
            "last_message_at": conv.last_message_at,
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
        }

    def _from_document(self, doc: dict) -> Conversation:
        return Conversation(
            id=UUID(doc["_id"]),
            participants=[UUID(p) for p in doc.get("participants", [])],
            last_message_content=doc.get("last_message_content"),
            last_message_sender_id=(
                UUID(doc["last_message_sender_id"])
                if doc.get("last_message_sender_id")
                else None
            ),
            last_message_at=doc.get("last_message_at"),
            created_at=doc.get("created_at", datetime.now(timezone.utc)),
            updated_at=doc.get("updated_at", datetime.now(timezone.utc)),
        )

    async def create(self, conversation: Conversation) -> Conversation:
        doc = self._to_document(conversation)
        await self._collection.insert_one(doc)
        return conversation

    async def get_by_id(self, conversation_id: UUID) -> Conversation | None:
        doc = await self._collection.find_one({"_id": str(conversation_id)})
        return self._from_document(doc) if doc else None

    async def get_by_participants(
        self, user_id_1: UUID, user_id_2: UUID
    ) -> Conversation | None:
        doc = await self._collection.find_one(
            {
                "participants": {
                    "$all": [str(user_id_1), str(user_id_2)],
                    "$size": 2,
                }
            }
        )
        return self._from_document(doc) if doc else None

    async def get_user_conversations(
        self, user_id: UUID, limit: int = 50, offset: int = 0
    ) -> list[Conversation]:
        cursor = (
            self._collection.find({"participants": str(user_id)})
            .sort("last_message_at", -1)
            .skip(offset)
            .limit(limit)
        )
        return [self._from_document(doc) async for doc in cursor]

    async def update(self, conversation: Conversation) -> Conversation:
        doc = self._to_document(conversation)
        await self._collection.replace_one({"_id": str(conversation.id)}, doc)
        return conversation

    async def delete(self, conversation_id: UUID) -> bool:
        result = await self._collection.delete_one({"_id": str(conversation_id)})
        return result.deleted_count > 0
