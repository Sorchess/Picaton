"""
MongoDB реализация репозитория корпоративных карточек.
"""

import re
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.entities.company_card import CompanyCard
from domain.entities.tag import Tag
from domain.enums.contact import ContactType
from domain.repositories.company_card import ICompanyCardRepository
from domain.values.contact import Contact


class MongoCompanyCardRepository(ICompanyCardRepository):
    """MongoDB реализация репозитория корпоративных карточек."""

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    def _entity_to_doc(self, entity: CompanyCard) -> dict:
        """Преобразовать сущность в документ MongoDB."""
        return {
            "_id": str(entity.id),
            "company_id": str(entity.company_id) if entity.company_id else None,
            "member_id": str(entity.member_id) if entity.member_id else None,
            "user_id": str(entity.user_id) if entity.user_id else None,
            # Корпоративные теги
            "company_name": entity.company_name,
            "position": entity.position,
            "department": entity.department,
            # Профильная информация
            "display_name": entity.display_name,
            "avatar_url": entity.avatar_url,
            "bio": entity.bio,
            "ai_generated_bio": entity.ai_generated_bio,
            # Контакты
            "contacts": [
                {
                    "type": c.type.value,
                    "value": c.value,
                    "label": c.label,
                    "is_primary": c.is_primary,
                }
                for c in entity.contacts
            ],
            # Теги
            "tags": [
                {
                    "id": str(t.id),
                    "name": t.name,
                    "category": t.category,
                }
                for t in entity.tags
            ],
            "search_tags": entity.search_tags,
            "custom_tag_values": entity.custom_tag_values,
            # Embedding
            "embedding": entity.embedding,
            # Статус
            "is_active": entity.is_active,
            "is_public": entity.is_public,
            "completeness": entity.completeness,
            # Timestamps
            "created_at": entity.created_at,
            "updated_at": entity.updated_at,
        }

    def _doc_to_entity(self, doc: dict) -> CompanyCard:
        """Преобразовать документ MongoDB в сущность."""
        contacts = [
            Contact(
                type=ContactType(c["type"]),
                value=c["value"],
                label=c.get("label"),
                is_primary=c.get("is_primary", False),
            )
            for c in doc.get("contacts", [])
        ]

        tags = [
            Tag(
                id=UUID(t["id"]) if t.get("id") else None,
                name=t["name"],
                category=t.get("category"),
            )
            for t in doc.get("tags", [])
        ]

        return CompanyCard(
            id=UUID(doc["_id"]),
            company_id=UUID(doc["company_id"]) if doc.get("company_id") else None,
            member_id=UUID(doc["member_id"]) if doc.get("member_id") else None,
            user_id=UUID(doc["user_id"]) if doc.get("user_id") else None,
            company_name=doc.get("company_name", ""),
            position=doc.get("position"),
            department=doc.get("department"),
            display_name=doc.get("display_name", ""),
            avatar_url=doc.get("avatar_url"),
            bio=doc.get("bio"),
            ai_generated_bio=doc.get("ai_generated_bio"),
            contacts=contacts,
            tags=tags,
            search_tags=doc.get("search_tags", []),
            custom_tag_values=doc.get("custom_tag_values", {}),
            embedding=doc.get("embedding", []),
            is_active=doc.get("is_active", True),
            is_public=doc.get("is_public", True),
            completeness=doc.get("completeness", 0),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        )

    async def create(self, entity: CompanyCard) -> CompanyCard:
        """Создать новую карточку."""
        doc = self._entity_to_doc(entity)
        await self._collection.insert_one(doc)
        return entity

    async def get_by_id(self, entity_id: UUID) -> CompanyCard | None:
        """Получить карточку по ID."""
        doc = await self._collection.find_one({"_id": str(entity_id)})
        return self._doc_to_entity(doc) if doc else None

    async def update(self, entity: CompanyCard) -> CompanyCard:
        """Обновить карточку."""
        doc = self._entity_to_doc(entity)
        await self._collection.replace_one({"_id": str(entity.id)}, doc)
        return entity

    async def delete(self, entity_id: UUID) -> bool:
        """Удалить карточку."""
        result = await self._collection.delete_one({"_id": str(entity_id)})
        return result.deleted_count > 0

    async def get_by_company_and_user(
        self, company_id: UUID, user_id: UUID
    ) -> CompanyCard | None:
        """Получить карточку сотрудника в компании."""
        doc = await self._collection.find_one(
            {
                "company_id": str(company_id),
                "user_id": str(user_id),
            }
        )
        return self._doc_to_entity(doc) if doc else None

    async def get_by_company_and_member(
        self, company_id: UUID, member_id: UUID
    ) -> CompanyCard | None:
        """Получить карточку по ID членства."""
        doc = await self._collection.find_one(
            {
                "company_id": str(company_id),
                "member_id": str(member_id),
            }
        )
        return self._doc_to_entity(doc) if doc else None

    async def get_by_company(
        self,
        company_id: UUID,
        include_inactive: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CompanyCard]:
        """Получить все карточки компании."""
        query = {"company_id": str(company_id)}
        if not include_inactive:
            query["is_active"] = True

        cursor = self._collection.find(query).skip(offset).limit(limit)
        return [self._doc_to_entity(doc) async for doc in cursor]

    async def count_by_company(
        self, company_id: UUID, include_inactive: bool = False
    ) -> int:
        """Подсчитать количество карточек в компании."""
        query = {"company_id": str(company_id)}
        if not include_inactive:
            query["is_active"] = True
        return await self._collection.count_documents(query)

    async def search_by_tags(
        self, company_id: UUID, tags: list[str], limit: int = 50
    ) -> list[CompanyCard]:
        """Найти карточки по тегам."""
        # Приводим теги к нижнему регистру для поиска
        lower_tags = [t.lower() for t in tags]

        query = {
            "company_id": str(company_id),
            "is_active": True,
            "search_tags": {"$in": lower_tags},
        }

        cursor = self._collection.find(query).limit(limit)
        return [self._doc_to_entity(doc) async for doc in cursor]

    async def search_by_text(
        self, company_id: UUID, query: str, limit: int = 50
    ) -> list[CompanyCard]:
        """Текстовый поиск по карточкам."""
        # Создаём regex для поиска
        escaped_query = re.escape(query)
        search_query = {
            "company_id": str(company_id),
            "is_active": True,
            "$or": [
                {"display_name": {"$regex": escaped_query, "$options": "i"}},
                {"position": {"$regex": escaped_query, "$options": "i"}},
                {"department": {"$regex": escaped_query, "$options": "i"}},
                {"bio": {"$regex": escaped_query, "$options": "i"}},
                {"search_tags": {"$regex": re.escape(query.lower()), "$options": "i"}},
            ],
        }

        cursor = self._collection.find(search_query).limit(limit)
        return [self._doc_to_entity(doc) async for doc in cursor]

    async def search_by_embedding(
        self, company_id: UUID, embedding: list[float], limit: int = 10
    ) -> list[CompanyCard]:
        """Семантический поиск по embedding."""
        # Используем $vectorSearch для Atlas или косинусное сходство
        # Для простоты — базовая реализация через aggregation
        pipeline = [
            {
                "$match": {
                    "company_id": str(company_id),
                    "is_active": True,
                    "embedding": {"$exists": True, "$ne": []},
                }
            },
            {
                "$addFields": {
                    "similarity": {
                        "$reduce": {
                            "input": {"$range": [0, {"$size": "$embedding"}]},
                            "initialValue": 0,
                            "in": {
                                "$add": [
                                    "$$value",
                                    {
                                        "$multiply": [
                                            {"$arrayElemAt": ["$embedding", "$$this"]},
                                            {"$arrayElemAt": [embedding, "$$this"]},
                                        ]
                                    },
                                ]
                            },
                        }
                    }
                }
            },
            {"$sort": {"similarity": -1}},
            {"$limit": limit},
        ]

        cursor = self._collection.aggregate(pipeline)
        return [self._doc_to_entity(doc) async for doc in cursor]

    async def get_by_position(
        self, company_id: UUID, position: str
    ) -> list[CompanyCard]:
        """Получить карточки по должности."""
        query = {
            "company_id": str(company_id),
            "is_active": True,
            "position": {"$regex": f"^{re.escape(position)}$", "$options": "i"},
        }

        cursor = self._collection.find(query)
        return [self._doc_to_entity(doc) async for doc in cursor]

    async def get_by_department(
        self, company_id: UUID, department: str
    ) -> list[CompanyCard]:
        """Получить карточки по отделу."""
        query = {
            "company_id": str(company_id),
            "is_active": True,
            "department": {"$regex": f"^{department}$", "$options": "i"},
        }

        cursor = self._collection.find(query)
        return [self._doc_to_entity(doc) async for doc in cursor]

    async def get_public_cards(
        self, company_id: UUID, limit: int = 100, offset: int = 0
    ) -> list[CompanyCard]:
        """Получить публичные карточки компании."""
        query = {
            "company_id": str(company_id),
            "is_active": True,
            "is_public": True,
        }

        cursor = self._collection.find(query).skip(offset).limit(limit)
        return [self._doc_to_entity(doc) async for doc in cursor]

    async def delete_by_company(self, company_id: UUID) -> int:
        """Удалить все карточки компании."""
        result = await self._collection.delete_many({"company_id": str(company_id)})
        return result.deleted_count

    async def delete_by_user(self, user_id: UUID) -> int:
        """Удалить все карточки пользователя."""
        result = await self._collection.delete_many({"user_id": str(user_id)})
        return result.deleted_count


async def create_company_card_indexes(collection: AsyncIOMotorCollection) -> None:
    """Создать индексы для коллекции корпоративных карточек."""
    # Уникальный индекс: один пользователь — одна карточка в компании
    await collection.create_index(
        [("company_id", 1), ("user_id", 1)],
        unique=True,
        name="unique_user_company_card",
    )

    # Индекс для поиска по членству
    await collection.create_index(
        [("company_id", 1), ("member_id", 1)], name="company_member_idx"
    )

    # Индекс для поиска по тегам
    await collection.create_index(
        [("company_id", 1), ("search_tags", 1)], name="company_search_tags_idx"
    )

    # Индекс для фильтрации по должности и отделу
    await collection.create_index(
        [("company_id", 1), ("position", 1)], name="company_position_idx"
    )
    await collection.create_index(
        [("company_id", 1), ("department", 1)], name="company_department_idx"
    )

    # Индекс для активных публичных карточек
    await collection.create_index(
        [("company_id", 1), ("is_active", 1), ("is_public", 1)],
        name="company_active_public_idx",
    )

    # Текстовый индекс для полнотекстового поиска
    await collection.create_index(
        [
            ("display_name", "text"),
            ("position", "text"),
            ("department", "text"),
            ("bio", "text"),
        ],
        name="company_card_text_search_idx",
    )
