"""
MongoDB реализация репозитория подтверждений навыков.
"""

from datetime import datetime
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.entities.skill_endorsement import SkillEndorsement
from domain.repositories.skill_endorsement import SkillEndorsementRepositoryInterface


class MongoSkillEndorsementRepository(SkillEndorsementRepositoryInterface):
    """MongoDB реализация репозитория подтверждений навыков."""

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    def _to_document(self, endorsement: SkillEndorsement) -> dict:
        """Преобразовать сущность в документ MongoDB."""
        return {
            "_id": str(endorsement.id),
            "endorser_id": str(endorsement.endorser_id),
            "card_id": str(endorsement.card_id),
            "tag_id": str(endorsement.tag_id),
            "tag_name": endorsement.tag_name,
            "tag_category": endorsement.tag_category,
            "card_owner_id": str(endorsement.card_owner_id),
            "created_at": endorsement.created_at,
            "endorser_name": endorsement.endorser_name,
            "endorser_avatar_url": endorsement.endorser_avatar_url,
        }

    def _from_document(self, doc: dict) -> SkillEndorsement:
        """Преобразовать документ MongoDB в сущность."""
        return SkillEndorsement(
            id=UUID(doc["_id"]),
            endorser_id=UUID(doc["endorser_id"]),
            card_id=UUID(doc["card_id"]),
            tag_id=UUID(doc["tag_id"]),
            tag_name=doc.get("tag_name", ""),
            tag_category=doc.get("tag_category", ""),
            card_owner_id=UUID(doc["card_owner_id"]),
            created_at=doc.get("created_at", datetime.utcnow()),
            endorser_name=doc.get("endorser_name", ""),
            endorser_avatar_url=doc.get("endorser_avatar_url"),
        )

    async def create(self, endorsement: SkillEndorsement) -> SkillEndorsement:
        """Создать подтверждение навыка."""
        doc = self._to_document(endorsement)
        await self._collection.insert_one(doc)
        return endorsement

    async def delete(self, endorser_id: UUID, card_id: UUID, tag_id: UUID) -> bool:
        """Удалить подтверждение (снять лайк)."""
        result = await self._collection.delete_one(
            {
                "endorser_id": str(endorser_id),
                "card_id": str(card_id),
                "tag_id": str(tag_id),
            }
        )
        return result.deleted_count > 0

    async def get_by_endorser_and_tag(
        self, endorser_id: UUID, card_id: UUID, tag_id: UUID
    ) -> SkillEndorsement | None:
        """Получить конкретное подтверждение."""
        doc = await self._collection.find_one(
            {
                "endorser_id": str(endorser_id),
                "card_id": str(card_id),
                "tag_id": str(tag_id),
            }
        )
        return self._from_document(doc) if doc else None

    async def get_endorsements_for_card(self, card_id: UUID) -> list[SkillEndorsement]:
        """Получить все подтверждения для карточки."""
        cursor = self._collection.find({"card_id": str(card_id)})
        endorsements = []
        async for doc in cursor:
            endorsements.append(self._from_document(doc))
        return endorsements

    async def get_endorsements_for_tag(
        self, card_id: UUID, tag_id: UUID
    ) -> list[SkillEndorsement]:
        """Получить подтверждения для конкретного навыка карточки."""
        cursor = self._collection.find(
            {
                "card_id": str(card_id),
                "tag_id": str(tag_id),
            }
        )
        endorsements = []
        async for doc in cursor:
            endorsements.append(self._from_document(doc))
        return endorsements

    async def get_endorsements_by_user(
        self, endorser_id: UUID
    ) -> list[SkillEndorsement]:
        """Получить все подтверждения, сделанные пользователем."""
        cursor = self._collection.find({"endorser_id": str(endorser_id)})
        endorsements = []
        async for doc in cursor:
            endorsements.append(self._from_document(doc))
        return endorsements

    async def get_endorsement_count_for_tag(self, card_id: UUID, tag_id: UUID) -> int:
        """Получить количество подтверждений для навыка."""
        count = await self._collection.count_documents(
            {
                "card_id": str(card_id),
                "tag_id": str(tag_id),
            }
        )
        return count

    async def get_endorsement_counts_for_card(self, card_id: UUID) -> dict[str, int]:
        """Получить количество подтверждений для всех навыков карточки."""
        pipeline = [
            {"$match": {"card_id": str(card_id)}},
            {"$group": {"_id": "$tag_id", "count": {"$sum": 1}}},
        ]
        cursor = self._collection.aggregate(pipeline)
        result = {}
        async for doc in cursor:
            result[doc["_id"]] = doc["count"]
        return result

    async def get_endorsers_from_contacts(
        self, card_id: UUID, tag_id: UUID, contact_user_ids: list[UUID]
    ) -> list[SkillEndorsement]:
        """
        Получить подтверждения от конкретных пользователей (контактов).
        """
        contact_ids_str = [str(uid) for uid in contact_user_ids]
        cursor = self._collection.find(
            {
                "card_id": str(card_id),
                "tag_id": str(tag_id),
                "endorser_id": {"$in": contact_ids_str},
            }
        )
        endorsements = []
        async for doc in cursor:
            endorsements.append(self._from_document(doc))
        return endorsements

    async def has_user_endorsed(
        self, endorser_id: UUID, card_id: UUID, tag_id: UUID
    ) -> bool:
        """Проверить, подтвердил ли пользователь навык."""
        doc = await self._collection.find_one(
            {
                "endorser_id": str(endorser_id),
                "card_id": str(card_id),
                "tag_id": str(tag_id),
            }
        )
        return doc is not None
