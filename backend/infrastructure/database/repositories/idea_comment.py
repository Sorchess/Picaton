"""MongoDB реализация репозитория комментариев к идеям."""

from datetime import datetime, timezone
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.entities.idea_comment import IdeaComment
from domain.repositories.idea_comment import IdeaCommentRepositoryInterface


class MongoIdeaCommentRepository(IdeaCommentRepositoryInterface):
    """MongoDB реализация репозитория комментариев к идеям."""

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    def _to_document(self, comment: IdeaComment) -> dict:
        """Преобразовать сущность в документ MongoDB."""
        return {
            "_id": str(comment.id),
            "idea_id": str(comment.idea_id),
            "author_id": str(comment.author_id),
            "content": comment.content,
            "is_feedback": comment.is_feedback,
            "is_question": comment.is_question,
            "swipe_id": str(comment.swipe_id) if comment.swipe_id else None,
            "is_hidden": comment.is_hidden,
            "hidden_reason": comment.hidden_reason,
            "created_at": comment.created_at,
            "updated_at": comment.updated_at,
        }

    def _from_document(self, doc: dict) -> IdeaComment:
        """Преобразовать документ MongoDB в сущность."""
        return IdeaComment(
            id=UUID(doc["_id"]),
            idea_id=UUID(doc["idea_id"]),
            author_id=UUID(doc["author_id"]),
            content=doc.get("content", ""),
            is_feedback=doc.get("is_feedback", True),
            is_question=doc.get("is_question", False),
            swipe_id=UUID(doc["swipe_id"]) if doc.get("swipe_id") else None,
            is_hidden=doc.get("is_hidden", False),
            hidden_reason=doc.get("hidden_reason"),
            created_at=doc.get("created_at", datetime.now(timezone.utc)),
            updated_at=doc.get("updated_at", datetime.now(timezone.utc)),
        )

    async def create(self, comment: IdeaComment) -> IdeaComment:
        """Создать комментарий."""
        doc = self._to_document(comment)
        await self._collection.insert_one(doc)
        return comment

    async def get_by_id(self, comment_id: UUID) -> IdeaComment | None:
        """Получить комментарий по ID."""
        doc = await self._collection.find_one({"_id": str(comment_id)})
        return self._from_document(doc) if doc else None

    async def get_by_idea(
        self,
        idea_id: UUID,
        include_hidden: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> list[IdeaComment]:
        """Получить комментарии к идее."""
        query = {"idea_id": str(idea_id)}
        if not include_hidden:
            query["is_hidden"] = False

        cursor = (
            self._collection.find(query)
            .sort("created_at", -1)
            .skip(offset)
            .limit(limit)
        )
        return [self._from_document(doc) async for doc in cursor]

    async def get_by_author(
        self,
        author_id: UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> list[IdeaComment]:
        """Получить комментарии пользователя."""
        cursor = (
            self._collection.find({"author_id": str(author_id)})
            .sort("created_at", -1)
            .skip(offset)
            .limit(limit)
        )
        return [self._from_document(doc) async for doc in cursor]

    async def update(self, comment: IdeaComment) -> IdeaComment:
        """Обновить комментарий."""
        doc = self._to_document(comment)
        await self._collection.replace_one({"_id": str(comment.id)}, doc)
        return comment

    async def delete(self, comment_id: UUID) -> bool:
        """Удалить комментарий."""
        result = await self._collection.delete_one({"_id": str(comment_id)})
        return result.deleted_count > 0

    async def count_by_idea(self, idea_id: UUID) -> int:
        """Подсчитать комментарии к идее."""
        return await self._collection.count_documents(
            {
                "idea_id": str(idea_id),
                "is_hidden": False,
            }
        )
