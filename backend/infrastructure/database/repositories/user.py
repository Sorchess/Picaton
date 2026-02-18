import re
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.entities.user import User
from domain.entities.tag import Tag
from domain.enums.contact import ContactType
from domain.enums.status import UserStatus
from domain.repositories.user import UserRepositoryInterface
from domain.values.contact import Contact


class MongoUserRepository(UserRepositoryInterface):
    """MongoDB реализация репозитория пользователей."""

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    def _to_document(self, user: User) -> dict:
        """Преобразовать сущность в документ MongoDB."""
        return {
            "_id": str(user.id),
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "hashed_password": user.hashed_password,
            "phone_hash": user.phone_hash,
            "avatar_url": user.avatar_url,
            "telegram_id": user.telegram_id,
            "telegram_username": user.telegram_username,
            "location": user.location,
            "position": user.position,
            "tags": [
                {
                    "id": str(tag.id),
                    "name": tag.name,
                    "category": tag.category,
                    "proficiency": tag.proficiency,
                }
                for tag in user.tags
            ],
            "search_tags": user.search_tags,
            "contacts": [
                {
                    "type": contact.type.value,
                    "value": contact.value,
                    "is_primary": contact.is_primary,
                    "is_visible": contact.is_visible,
                }
                for contact in user.contacts
            ],
            "status": user.status.value,
            "bio": user.bio,
            "random_facts": user.random_facts,
            "ai_generated_bio": user.ai_generated_bio,
            "embedding": user.embedding,
            "profile_completeness": user.profile_completeness,
            "is_public": user.is_public,
            "is_onboarded": user.is_onboarded,
        }

    def _from_document(self, doc: dict) -> User:
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
                type=ContactType(contact["type"]),
                value=contact["value"],
                is_primary=contact.get("is_primary", False),
                is_visible=contact.get("is_visible", True),
            )
            for contact in doc.get("contacts", [])
        ]

        return User(
            id=UUID(doc["_id"]),
            first_name=doc.get("first_name", ""),
            last_name=doc.get("last_name", ""),
            email=doc.get("email", ""),
            hashed_password=doc.get("hashed_password", ""),
            phone_hash=doc.get("phone_hash"),
            avatar_url=doc.get("avatar_url"),
            telegram_id=doc.get("telegram_id"),
            telegram_username=doc.get("telegram_username"),
            location=doc.get("location"),
            position=doc.get("position"),
            tags=tags,
            search_tags=doc.get("search_tags", []),
            contacts=contacts,
            status=UserStatus(doc.get("status", "available")),
            bio=doc.get("bio"),
            random_facts=doc.get("random_facts", []),
            ai_generated_bio=doc.get("ai_generated_bio"),
            embedding=doc.get("embedding", []),
            profile_completeness=doc.get("profile_completeness", 0),
            is_public=doc.get("is_public", True),
            is_onboarded=doc.get("is_onboarded", True),
        )

    async def get_by_id(self, user_id: UUID) -> User | None:
        """Получить пользователя по ID."""
        doc = await self._collection.find_one({"_id": str(user_id)})
        return self._from_document(doc) if doc else None

    async def get_by_email(self, email: str) -> User | None:
        """Получить пользователя по email."""
        doc = await self._collection.find_one({"email": email})
        return self._from_document(doc) if doc else None

    async def create(self, user: User) -> User:
        """Создать пользователя."""
        doc = self._to_document(user)
        await self._collection.insert_one(doc)
        return user

    async def update(self, user: User) -> User:
        """Обновить пользователя."""
        doc = self._to_document(user)
        await self._collection.replace_one({"_id": str(user.id)}, doc)
        return user

    async def delete(self, user_id: UUID) -> bool:
        """Удалить пользователя."""
        result = await self._collection.delete_one({"_id": str(user_id)})
        return result.deleted_count > 0

    async def search_by_tags(self, tags: list[str], limit: int = 20) -> list[User]:
        """Поиск пользователей по тегам."""
        normalized_tags = [tag.lower().strip() for tag in tags]
        cursor = self._collection.find({"search_tags": {"$in": normalized_tags}}).limit(
            limit
        )

        users = []
        async for doc in cursor:
            users.append(self._from_document(doc))
        return users

    async def search_by_text(self, query: str, limit: int = 20) -> list[User]:
        """Полнотекстовый поиск пользователей."""
        try:
            # Используем текстовый индекс MongoDB
            cursor = (
                self._collection.find(
                    {"$text": {"$search": query}}, {"score": {"$meta": "textScore"}}
                )
                .sort([("score", {"$meta": "textScore"})])
                .limit(limit)
            )

            users = []
            async for doc in cursor:
                users.append(self._from_document(doc))
            return users
        except Exception:
            # Если текстовый индекс не создан, делаем fallback на regex поиск
            # Экранируем спецсимволы для защиты от ReDoS
            safe_query = re.escape(query)
            regex_pattern = {"$regex": safe_query, "$options": "i"}
            cursor = self._collection.find(
                {
                    "$or": [
                        {"first_name": regex_pattern},
                        {"last_name": regex_pattern},
                        {"bio": regex_pattern},
                        {"search_tags": regex_pattern},
                    ]
                }
            ).limit(limit)

            users = []
            async for doc in cursor:
                users.append(self._from_document(doc))
            return users

    async def search_by_embedding(
        self, embedding: list[float], limit: int = 20
    ) -> list[User]:
        """Семантический поиск по embedding (используя MongoDB Atlas Vector Search)."""
        # Для полноценного vector search нужен MongoDB Atlas
        # Здесь базовая реализация
        pipeline = [
            {
                "$search": {
                    "knnBeta": {
                        "vector": embedding,
                        "path": "embedding",
                        "k": limit,
                    }
                }
            },
            {"$limit": limit},
        ]

        users = []
        async for doc in self._collection.aggregate(pipeline):
            users.append(self._from_document(doc))
        return users

    async def get_all(self, skip: int = 0, limit: int = 100) -> list[User]:
        """Получить всех пользователей с пагинацией."""
        cursor = self._collection.find().skip(skip).limit(limit)

        users = []
        async for doc in cursor:
            users.append(self._from_document(doc))
        return users

    async def search_by_bio_keywords(
        self, keywords: list[str], limit: int = 20
    ) -> list[User]:
        """Поиск пользователей по ключевым словам в bio и ai_generated_bio."""
        if not keywords:
            return []

        # Создаём regex паттерны для каждого ключевого слова
        or_conditions = []
        for keyword in keywords:
            # Экранируем спецсимволы для безопасного regex
            safe_keyword = re.escape(keyword)
            regex_pattern = {"$regex": safe_keyword, "$options": "i"}
            or_conditions.append({"bio": regex_pattern})
            or_conditions.append({"ai_generated_bio": regex_pattern})

        cursor = self._collection.find({"$or": or_conditions}).limit(limit)

        users = []
        async for doc in cursor:
            users.append(self._from_document(doc))
        return users

    async def find_by_phone_hashes(self, hashes: list[str]) -> list[User]:
        """Найти пользователей по хешам телефонов."""
        if not hashes:
            return []

        cursor = self._collection.find({"phone_hash": {"$in": hashes}})

        users = []
        async for doc in cursor:
            users.append(self._from_document(doc))
        return users

    # Telegram методы

    async def find_by_telegram_id(self, telegram_id: int) -> User | None:
        """Найти пользователя по Telegram ID."""
        doc = await self._collection.find_one({"telegram_id": telegram_id})
        return self._from_document(doc) if doc else None

    async def find_by_telegram_ids(self, telegram_ids: list[int]) -> list[User]:
        """Найти пользователей по списку Telegram ID."""
        if not telegram_ids:
            return []

        cursor = self._collection.find({"telegram_id": {"$in": telegram_ids}})

        users = []
        async for doc in cursor:
            users.append(self._from_document(doc))
        return users

    async def find_by_telegram_usernames(self, usernames: list[str]) -> list[User]:
        """Найти пользователей по Telegram username."""
        if not usernames:
            return []

        # Нормализуем usernames (убираем @, приводим к нижнему регистру)
        normalized = [u.lstrip("@").lower() for u in usernames if u]

        # Ищем без учёта регистра
        cursor = self._collection.find(
            {
                "telegram_username": {
                    "$regex": f"^({'|'.join(normalized)})$",
                    "$options": "i",
                }
            }
        )

        users = []
        async for doc in cursor:
            users.append(self._from_document(doc))
        return users
