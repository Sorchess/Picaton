"""
MongoDB реализация репозитория настроек тегов компании.
"""

from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.entities.company_settings import CompanyTagSettings, TagFieldSettings
from domain.repositories.company_tag_settings import ICompanyTagSettingsRepository


class MongoCompanyTagSettingsRepository(ICompanyTagSettingsRepository):
    """MongoDB реализация репозитория настроек тегов компании."""

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    def _field_settings_to_doc(self, settings: TagFieldSettings) -> dict:
        """Преобразовать настройки поля в документ."""
        return {
            "is_required": settings.is_required,
            "is_enabled": settings.is_enabled,
            "display_name": settings.display_name,
            "placeholder": settings.placeholder,
            "options": settings.options,
            "restrict_to_options": settings.restrict_to_options,
        }

    def _doc_to_field_settings(self, doc: dict) -> TagFieldSettings:
        """Преобразовать документ в настройки поля."""
        return TagFieldSettings(
            is_required=doc.get("is_required", False),
            is_enabled=doc.get("is_enabled", True),
            display_name=doc.get("display_name"),
            placeholder=doc.get("placeholder"),
            options=doc.get("options", []),
            restrict_to_options=doc.get("restrict_to_options", False),
        )

    def _entity_to_doc(self, entity: CompanyTagSettings) -> dict:
        """Преобразовать сущность в документ MongoDB."""
        return {
            "_id": str(entity.id),
            "company_id": str(entity.company_id) if entity.company_id else None,
            # Встроенные теги
            "company_tag": self._field_settings_to_doc(entity.company_tag),
            "position_tag": self._field_settings_to_doc(entity.position_tag),
            "department_tag": self._field_settings_to_doc(entity.department_tag),
            # Кастомные теги
            "custom_tags": {
                tag_id: self._field_settings_to_doc(settings)
                for tag_id, settings in entity.custom_tags.items()
            },
            # Timestamps
            "created_at": entity.created_at,
            "updated_at": entity.updated_at,
        }

    def _doc_to_entity(self, doc: dict) -> CompanyTagSettings:
        """Преобразовать документ MongoDB в сущность."""
        custom_tags = {
            tag_id: self._doc_to_field_settings(settings)
            for tag_id, settings in doc.get("custom_tags", {}).items()
        }

        return CompanyTagSettings(
            id=UUID(doc["_id"]),
            company_id=UUID(doc["company_id"]) if doc.get("company_id") else None,
            company_tag=self._doc_to_field_settings(doc.get("company_tag", {})),
            position_tag=self._doc_to_field_settings(doc.get("position_tag", {})),
            department_tag=self._doc_to_field_settings(doc.get("department_tag", {})),
            custom_tags=custom_tags,
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        )

    async def create(self, entity: CompanyTagSettings) -> CompanyTagSettings:
        """Создать настройки тегов."""
        doc = self._entity_to_doc(entity)
        await self._collection.insert_one(doc)
        return entity

    async def get_by_id(self, entity_id: UUID) -> CompanyTagSettings | None:
        """Получить настройки по ID."""
        doc = await self._collection.find_one({"_id": str(entity_id)})
        return self._doc_to_entity(doc) if doc else None

    async def update(self, entity: CompanyTagSettings) -> CompanyTagSettings:
        """Обновить настройки."""
        doc = self._entity_to_doc(entity)
        await self._collection.replace_one({"_id": str(entity.id)}, doc)
        return entity

    async def delete(self, entity_id: UUID) -> bool:
        """Удалить настройки."""
        result = await self._collection.delete_one({"_id": str(entity_id)})
        return result.deleted_count > 0

    async def get_by_company(self, company_id: UUID) -> CompanyTagSettings | None:
        """Получить настройки тегов компании."""
        doc = await self._collection.find_one({"company_id": str(company_id)})
        return self._doc_to_entity(doc) if doc else None

    async def delete_by_company(self, company_id: UUID) -> bool:
        """Удалить настройки тегов компании."""
        result = await self._collection.delete_one({"company_id": str(company_id)})
        return result.deleted_count > 0


async def create_company_tag_settings_indexes(collection: AsyncIOMotorCollection) -> None:
    """Создать индексы для коллекции настроек тегов."""
    # Уникальный индекс: одни настройки на компанию
    await collection.create_index(
        [("company_id", 1)],
        unique=True,
        name="unique_company_tag_settings"
    )
