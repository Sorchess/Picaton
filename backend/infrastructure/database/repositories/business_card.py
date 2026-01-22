"""MongoDB реализация репозитория визитных карточек."""

from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.entities.business_card import BusinessCard
from domain.entities.tag import Tag
from domain.enums.contact import ContactType
from domain.repositories.business_card import BusinessCardRepositoryInterface
from domain.values.contact import Contact


class MongoBusinessCardRepository(BusinessCardRepositoryInterface):
    """MongoDB реализация репозитория визитных карточек."""

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    def _to_document(self, card: BusinessCard) -> dict:
        """Преобразовать сущность в документ MongoDB."""
        return {
            "_id": str(card.id),
            "owner_id": str(card.owner_id),
            "title": card.title,
            "is_primary": card.is_primary,
            "is_active": card.is_active,
            "display_name": card.display_name,
            "avatar_url": card.avatar_url,
            "tags": [
                {
                    "id": str(tag.id),
                    "name": tag.name,
                    "category": tag.category,
                    "proficiency": tag.proficiency,
                }
                for tag in card.tags
            ],
            "search_tags": card.search_tags,
            "contacts": [
                {
                    "type": contact.type.value,
                    "value": contact.value,
                    "is_primary": contact.is_primary,
                    "is_visible": contact.is_visible,
                }
                for contact in card.contacts
            ],
            "bio": card.bio,
            "random_facts": card.random_facts,
            "ai_generated_bio": card.ai_generated_bio,
            "embedding": card.embedding,
            "completeness": card.completeness,
            "is_public": card.is_public,
            "emojis": card.emojis,
        }

    def _from_document(self, doc: dict) -> BusinessCard:
        """Преобразовать документ MongoDB в сущность."""
        tags = [
            Tag(
                id=UUID(tag["id"]),
                name=tag["name"],
                category=tag["category"],
                proficiency=tag.get("proficiency", 1),
            )
            for tag in doc.get("tags", [])
        ]

        contacts = [
            Contact(
                type=ContactType(contact["type"].upper()),
                value=contact["value"],
                is_primary=contact.get("is_primary", False),
                is_visible=contact.get("is_visible", True),
            )
            for contact in doc.get("contacts", [])
        ]

        return BusinessCard(
            id=UUID(doc["_id"]),
            owner_id=UUID(doc["owner_id"]),
            title=doc.get("title", "Основная"),
            is_primary=doc.get("is_primary", False),
            is_active=doc.get("is_active", True),
            display_name=doc.get("display_name", ""),
            avatar_url=doc.get("avatar_url"),
            tags=tags,
            search_tags=doc.get("search_tags", []),
            contacts=contacts,
            bio=doc.get("bio"),
            random_facts=doc.get("random_facts", []),
            ai_generated_bio=doc.get("ai_generated_bio"),
            embedding=doc.get("embedding", []),
            completeness=doc.get("completeness", 0),
            is_public=doc.get("is_public", True),
            emojis=doc.get("emojis", []),
        )

    async def get_by_id(self, card_id: UUID) -> BusinessCard | None:
        """Получить карточку по ID."""
        doc = await self._collection.find_one({"_id": str(card_id)})
        return self._from_document(doc) if doc else None

    async def get_by_owner(self, owner_id: UUID) -> list[BusinessCard]:
        """Получить все карточки пользователя."""
        cursor = self._collection.find({"owner_id": str(owner_id)})
        cards = []
        async for doc in cursor:
            cards.append(self._from_document(doc))
        return cards

    async def get_primary_by_owner(self, owner_id: UUID) -> BusinessCard | None:
        """Получить основную карточку пользователя."""
        doc = await self._collection.find_one(
            {
                "owner_id": str(owner_id),
                "is_primary": True,
            }
        )
        return self._from_document(doc) if doc else None

    async def create(self, card: BusinessCard) -> BusinessCard:
        """Создать карточку."""
        doc = self._to_document(card)
        await self._collection.insert_one(doc)
        return card

    async def update(self, card: BusinessCard) -> BusinessCard:
        """Обновить карточку."""
        doc = self._to_document(card)
        await self._collection.replace_one({"_id": str(card.id)}, doc)
        return card

    async def delete(self, card_id: UUID) -> bool:
        """Удалить карточку."""
        result = await self._collection.delete_one({"_id": str(card_id)})
        return result.deleted_count > 0

    async def set_primary(self, owner_id: UUID, card_id: UUID) -> bool:
        """Установить карточку как основную (сбросив флаг у остальных)."""
        # Сбрасываем is_primary у всех карточек пользователя
        await self._collection.update_many(
            {"owner_id": str(owner_id)},
            {"$set": {"is_primary": False}},
        )
        # Устанавливаем is_primary для выбранной карточки
        result = await self._collection.update_one(
            {"_id": str(card_id), "owner_id": str(owner_id)},
            {"$set": {"is_primary": True}},
        )
        return result.modified_count > 0

    async def search_by_tags(
        self, tags: list[str], limit: int = 20, public_only: bool = True
    ) -> list[BusinessCard]:
        """Поиск карточек по тегам."""
        normalized_tags = [tag.lower().strip() for tag in tags]
        query = {
            "search_tags": {"$in": normalized_tags},
            "is_active": True,
        }
        if public_only:
            query["is_public"] = True
        cursor = self._collection.find(query).limit(limit)

        cards = []
        async for doc in cursor:
            cards.append(self._from_document(doc))
        return cards

    async def search_by_text(
        self, query: str, limit: int = 20, public_only: bool = True
    ) -> list[BusinessCard]:
        """Полнотекстовый поиск карточек."""
        query_lower = query.lower().strip()
        match_query = {
            "is_active": True,
            "$or": [
                {"display_name": {"$regex": query_lower, "$options": "i"}},
                {"bio": {"$regex": query_lower, "$options": "i"}},
                {"title": {"$regex": query_lower, "$options": "i"}},
                {"search_tags": {"$regex": query_lower, "$options": "i"}},
            ],
        }
        if public_only:
            match_query["is_public"] = True
        cursor = self._collection.find(match_query).limit(limit)

        cards = []
        async for doc in cursor:
            cards.append(self._from_document(doc))
        return cards

    async def search_by_bio_keywords(
        self, keywords: list[str], limit: int = 20, public_only: bool = True
    ) -> list[BusinessCard]:
        """Поиск карточек по ключевым словам в bio."""
        # Создаём regex паттерны для каждого ключевого слова
        or_conditions = []
        for keyword in keywords:
            keyword_lower = keyword.lower().strip()
            if keyword_lower:
                or_conditions.append(
                    {"bio": {"$regex": keyword_lower, "$options": "i"}}
                )
                or_conditions.append(
                    {"ai_generated_bio": {"$regex": keyword_lower, "$options": "i"}}
                )

        if not or_conditions:
            return []

        match_query = {
            "is_active": True,
            "$or": or_conditions,
        }
        if public_only:
            match_query["is_public"] = True
        cursor = self._collection.find(match_query).limit(limit)

        cards = []
        async for doc in cursor:
            cards.append(self._from_document(doc))
        return cards

    async def count_by_owner(self, owner_id: UUID) -> int:
        """Количество карточек у пользователя."""
        return await self._collection.count_documents({"owner_id": str(owner_id)})

    async def update_visibility_by_owner(self, owner_id: UUID, is_public: bool) -> int:
        """Обновить видимость всех карточек пользователя."""
        result = await self._collection.update_many(
            {"owner_id": str(owner_id)},
            {"$set": {"is_public": is_public}},
        )
        return result.modified_count

    async def update_avatar_by_owner(
        self, owner_id: UUID, avatar_url: str | None
    ) -> int:
        """Обновить аватарку во всех карточках пользователя."""
        result = await self._collection.update_many(
            {"owner_id": str(owner_id)},
            {"$set": {"avatar_url": avatar_url}},
        )
        return result.modified_count

    async def get_by_ids(self, card_ids: list[UUID]) -> list[BusinessCard]:
        """Получить карточки по списку ID."""
        if not card_ids:
            return []
        cursor = self._collection.find({"_id": {"$in": [str(cid) for cid in card_ids]}})
        cards = []
        async for doc in cursor:
            cards.append(self._from_document(doc))
        return cards

    async def search_by_tags_and_ids(
        self,
        tags: list[str],
        card_ids: list[UUID],
        limit: int = 20,
        public_only: bool = True,
    ) -> list[BusinessCard]:
        """Поиск карточек по тегам среди указанных ID."""
        if not card_ids:
            return []
        normalized_tags = [tag.lower().strip() for tag in tags]
        query = {
            "_id": {"$in": [str(cid) for cid in card_ids]},
            "search_tags": {"$in": normalized_tags},
            "is_active": True,
        }
        if public_only:
            query["is_public"] = True
        cursor = self._collection.find(query).limit(limit)

        cards = []
        async for doc in cursor:
            cards.append(self._from_document(doc))
        return cards

    async def search_by_text_and_ids(
        self,
        query: str,
        card_ids: list[UUID],
        limit: int = 20,
        public_only: bool = True,
    ) -> list[BusinessCard]:
        """Полнотекстовый поиск среди указанных карточек."""
        if not card_ids:
            return []
        query_lower = query.lower().strip()
        match_query = {
            "_id": {"$in": [str(cid) for cid in card_ids]},
            "is_active": True,
            "$or": [
                {"display_name": {"$regex": query_lower, "$options": "i"}},
                {"bio": {"$regex": query_lower, "$options": "i"}},
                {"title": {"$regex": query_lower, "$options": "i"}},
                {"search_tags": {"$regex": query_lower, "$options": "i"}},
            ],
        }
        if public_only:
            match_query["is_public"] = True
        cursor = self._collection.find(match_query).limit(limit)

        cards = []
        async for doc in cursor:
            cards.append(self._from_document(doc))
        return cards

    async def search_by_bio_keywords_and_ids(
        self,
        keywords: list[str],
        card_ids: list[UUID],
        limit: int = 20,
        public_only: bool = True,
    ) -> list[BusinessCard]:
        """Поиск карточек по ключевым словам в bio среди указанных ID."""
        if not card_ids:
            return []
        or_conditions = []
        for keyword in keywords:
            keyword_lower = keyword.lower().strip()
            if keyword_lower:
                or_conditions.append(
                    {"bio": {"$regex": keyword_lower, "$options": "i"}}
                )
                or_conditions.append(
                    {"ai_generated_bio": {"$regex": keyword_lower, "$options": "i"}}
                )

        if not or_conditions:
            return []

        match_query = {
            "_id": {"$in": [str(cid) for cid in card_ids]},
            "is_active": True,
            "$or": or_conditions,
        }
        if public_only:
            match_query["is_public"] = True
        cursor = self._collection.find(match_query).limit(limit)

        cards = []
        async for doc in cursor:
            cards.append(self._from_document(doc))
        return cards
