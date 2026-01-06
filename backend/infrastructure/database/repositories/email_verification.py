from datetime import datetime, timezone
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.repositories.email_verification import EmailVerificationRepositoryInterface


class MongoEmailVerificationRepository(EmailVerificationRepositoryInterface):
    """MongoDB реализация репозитория верификации email.

    Документ в коллекции:
    {
        "user_id": str,       # UUID пользователя
        "email": str,         # Email для верификации
        "code": str,          # 6-значный код подтверждения
        "expires_at": datetime,
        "created_at": datetime
    }

    Индексы:
    - user_id - уникальный индекс (один код на пользователя)
    - expires_at - TTL индекс для автоудаления
    """

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    async def save_verification_code(
        self,
        user_id: UUID,
        email: str,
        code: str,
        expires_at: datetime,
    ) -> None:
        """Сохранить код верификации (перезаписывает предыдущий)."""
        await self._collection.update_one(
            {"user_id": str(user_id)},
            {
                "$set": {
                    "user_id": str(user_id),
                    "email": email,
                    "code": code,
                    "expires_at": expires_at,
                    "created_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )

    async def get_verification(
        self,
        user_id: UUID,
        code: str,
    ) -> tuple[str, datetime] | None:
        """Получить данные верификации по коду."""
        doc = await self._collection.find_one({"user_id": str(user_id), "code": code})
        if not doc:
            return None
        return (doc["email"], doc["expires_at"])

    async def delete_verification(self, user_id: UUID) -> None:
        """Удалить запись верификации для пользователя."""
        await self._collection.delete_one({"user_id": str(user_id)})

    async def delete_expired(self) -> int:
        """Удалить все истёкшие записи верификации."""
        result = await self._collection.delete_many(
            {"expires_at": {"$lt": datetime.now(timezone.utc)}}
        )
        return result.deleted_count
