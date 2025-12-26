from datetime import datetime, timezone
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection

from domain.repositories.pending_hash import PendingHashRepositoryInterface


class MongoPendingHashRepository(PendingHashRepositoryInterface):
    """MongoDB реализация репозитория pending phone hashes.

    Документ в коллекции:
    {
        "owner_id": str,      # UUID владельца (кто синхронизировал)
        "phone_hash": str,    # SHA-256 хеш телефона
        "created_at": datetime
    }

    Индексы:
    - (owner_id, phone_hash) - уникальный составной индекс
    - phone_hash - для быстрого поиска при регистрации
    """

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    async def save_pending(self, owner_id: UUID, hashes: list[str]) -> int:
        """Сохранить pending хеши для пользователя."""
        if not hashes:
            return 0

        documents = [
            {
                "owner_id": str(owner_id),
                "phone_hash": phone_hash,
                "created_at": datetime.now(timezone.utc),
            }
            for phone_hash in hashes
        ]

        # Используем ordered=False чтобы продолжить при дубликатах
        try:
            result = await self._collection.insert_many(documents, ordered=False)
            return len(result.inserted_ids)
        except Exception:
            # Некоторые записи могут быть дубликатами - это нормально
            return 0

    async def find_owners_by_hash(self, phone_hash: str) -> list[UUID]:
        """Найти всех пользователей, ожидающих контакт с данным хешем."""
        cursor = self._collection.find({"phone_hash": phone_hash})

        owners = []
        async for doc in cursor:
            owners.append(UUID(doc["owner_id"]))

        return owners

    async def remove_pending(self, owner_id: UUID, phone_hash: str) -> bool:
        """Удалить pending хеш для пользователя."""
        result = await self._collection.delete_one(
            {"owner_id": str(owner_id), "phone_hash": phone_hash}
        )
        return result.deleted_count > 0

    async def remove_all_for_hash(self, phone_hash: str) -> int:
        """Удалить все pending записи для хеша."""
        result = await self._collection.delete_many({"phone_hash": phone_hash})
        return result.deleted_count

    async def get_pending_for_owner(self, owner_id: UUID) -> list[str]:
        """Получить все pending хеши для пользователя."""
        cursor = self._collection.find({"owner_id": str(owner_id)})

        hashes = []
        async for doc in cursor:
            hashes.append(doc["phone_hash"])

        return hashes
