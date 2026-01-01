from datetime import datetime
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.entities.saved_contact import SavedContact
from domain.values.contact import Contact
from domain.enums.contact import ContactType
from domain.repositories.saved_contact import SavedContactRepositoryInterface


class MongoSavedContactRepository(SavedContactRepositoryInterface):
    """MongoDB реализация репозитория сохраненных контактов."""

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    def _to_document(self, contact: SavedContact) -> dict:
        """Преобразовать сущность в документ MongoDB."""
        return {
            "_id": str(contact.id),
            "owner_id": str(contact.owner_id),
            "saved_user_id": (
                str(contact.saved_user_id) if contact.saved_user_id else None
            ),
            "saved_card_id": (
                str(contact.saved_card_id) if contact.saved_card_id else None
            ),
            "name": contact.name,
            "first_name": contact.first_name,
            "last_name": contact.last_name,
            "phone": contact.phone,
            "email": contact.email,
            "contacts": [
                {
                    "type": c.type.value if hasattr(c.type, "value") else c.type,
                    "value": c.value,
                    "is_primary": c.is_primary,
                    "is_visible": c.is_visible,
                }
                for c in (contact.contacts or [])
            ],
            "messenger_type": contact.messenger_type,
            "messenger_value": contact.messenger_value,
            "notes": contact.notes,
            "search_tags": contact.search_tags,
            "source": contact.source,
            "created_at": contact.created_at,
            "updated_at": contact.updated_at,
        }

    def _from_document(self, doc: dict) -> SavedContact:
        """Преобразовать документ MongoDB в сущность."""
        # Парсим контакты
        contacts = []
        for c in doc.get("contacts", []):
            try:
                contact_type = (
                    ContactType(c["type"].upper())
                    if isinstance(c["type"], str)
                    else c["type"]
                )
                contacts.append(
                    Contact(
                        type=contact_type,
                        value=c["value"],
                        is_primary=c.get("is_primary", False),
                        is_visible=c.get("is_visible", True),
                    )
                )
            except (KeyError, ValueError):
                continue

        return SavedContact(
            id=UUID(doc["_id"]),
            owner_id=UUID(doc["owner_id"]),
            saved_user_id=(
                UUID(doc["saved_user_id"]) if doc.get("saved_user_id") else None
            ),
            saved_card_id=(
                UUID(doc["saved_card_id"]) if doc.get("saved_card_id") else None
            ),
            name=doc.get("name", ""),
            first_name=doc.get("first_name", ""),
            last_name=doc.get("last_name", ""),
            phone=doc.get("phone"),
            email=doc.get("email"),
            contacts=contacts,
            messenger_type=doc.get("messenger_type"),
            messenger_value=doc.get("messenger_value"),
            notes=doc.get("notes"),
            search_tags=doc.get("search_tags", []),
            source=doc.get("source", "manual"),
            created_at=doc.get("created_at", datetime.utcnow()),
            updated_at=doc.get("updated_at", datetime.utcnow()),
        )

    async def get_by_id(self, contact_id: UUID) -> SavedContact | None:
        """Получить контакт по ID."""
        doc = await self._collection.find_one({"_id": str(contact_id)})
        return self._from_document(doc) if doc else None

    async def get_by_owner(
        self, owner_id: UUID, skip: int = 0, limit: int = 100
    ) -> list[SavedContact]:
        """Получить все контакты пользователя."""
        cursor = (
            self._collection.find({"owner_id": str(owner_id)}).skip(skip).limit(limit)
        )

        contacts = []
        async for doc in cursor:
            contacts.append(self._from_document(doc))
        return contacts

    async def create(self, contact: SavedContact) -> SavedContact:
        """Создать контакт."""
        doc = self._to_document(contact)
        await self._collection.insert_one(doc)
        return contact

    async def update(self, contact: SavedContact) -> SavedContact:
        """Обновить контакт."""
        contact.updated_at = datetime.utcnow()
        doc = self._to_document(contact)
        await self._collection.replace_one({"_id": str(contact.id)}, doc)
        return contact

    async def delete(self, contact_id: UUID) -> bool:
        """Удалить контакт."""
        result = await self._collection.delete_one({"_id": str(contact_id)})
        return result.deleted_count > 0

    async def search_by_tags(
        self, owner_id: UUID, tags: list[str], limit: int = 20
    ) -> list[SavedContact]:
        """Поиск контактов по тегам."""
        normalized_tags = [tag.lower().strip() for tag in tags]
        cursor = self._collection.find(
            {"owner_id": str(owner_id), "search_tags": {"$in": normalized_tags}}
        ).limit(limit)

        contacts = []
        async for doc in cursor:
            contacts.append(self._from_document(doc))
        return contacts

    async def search_by_text(
        self, owner_id: UUID, query: str, limit: int = 20
    ) -> list[SavedContact]:
        """Полнотекстовый поиск контактов."""
        cursor = (
            self._collection.find(
                {"owner_id": str(owner_id), "$text": {"$search": query}},
                {"score": {"$meta": "textScore"}},
            )
            .sort([("score", {"$meta": "textScore"})])
            .limit(limit)
        )

        contacts = []
        async for doc in cursor:
            contacts.append(self._from_document(doc))
        return contacts

    async def bulk_create(self, contacts: list[SavedContact]) -> list[SavedContact]:
        """Массовое создание контактов (для импорта)."""
        if not contacts:
            return []

        docs = [self._to_document(contact) for contact in contacts]
        await self._collection.insert_many(docs)
        return contacts

    async def exists(self, owner_id: UUID, saved_user_id: UUID) -> bool:
        """Проверить, существует ли контакт."""
        doc = await self._collection.find_one(
            {"owner_id": str(owner_id), "saved_user_id": str(saved_user_id)}
        )
        return doc is not None
