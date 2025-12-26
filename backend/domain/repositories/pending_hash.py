from abc import ABC, abstractmethod
from uuid import UUID


class PendingHashRepositoryInterface(ABC):
    """Интерфейс репозитория для хранения pending phone hashes.

    Используется для уведомления пользователей, когда их контакты
    регистрируются в системе (как в WhatsApp/Telegram).
    """

    @abstractmethod
    async def save_pending(self, owner_id: UUID, hashes: list[str]) -> int:
        """
        Сохранить pending хеши для пользователя.

        Args:
            owner_id: ID пользователя, который синхронизировал контакты
            hashes: Список хешей телефонов, которые не найдены в системе

        Returns:
            Количество сохраненных хешей
        """
        pass

    @abstractmethod
    async def find_owners_by_hash(self, phone_hash: str) -> list[UUID]:
        """
        Найти всех пользователей, ожидающих контакт с данным хешем.

        Args:
            phone_hash: SHA-256 хеш телефона

        Returns:
            Список ID пользователей, у которых этот хеш в pending
        """
        pass

    @abstractmethod
    async def remove_pending(self, owner_id: UUID, phone_hash: str) -> bool:
        """
        Удалить pending хеш для пользователя.

        Args:
            owner_id: ID пользователя
            phone_hash: Хеш телефона для удаления

        Returns:
            True если запись была удалена
        """
        pass

    @abstractmethod
    async def remove_all_for_hash(self, phone_hash: str) -> int:
        """
        Удалить все pending записи для хеша (после регистрации пользователя).

        Args:
            phone_hash: Хеш телефона

        Returns:
            Количество удаленных записей
        """
        pass

    @abstractmethod
    async def get_pending_for_owner(self, owner_id: UUID) -> list[str]:
        """
        Получить все pending хеши для пользователя.

        Args:
            owner_id: ID пользователя

        Returns:
            Список pending хешей
        """
        pass
