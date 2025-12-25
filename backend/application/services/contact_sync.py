"""
Contact Sync Service - Enterprise/Privacy-First approach.

This service handles contact synchronization using SHA-256 hashes.
The server NEVER receives raw phone numbers, only their hashes.
"""

from dataclasses import dataclass
from uuid import UUID

from domain.repositories import UserRepositoryInterface


@dataclass
class HashedContact:
    """Хешированный контакт для синхронизации."""

    name: str
    hash: str


@dataclass
class FoundUser:
    """Найденный пользователь."""

    id: UUID
    name: str
    avatar_url: str | None


@dataclass
class FoundContact:
    """Результат сопоставления контакта."""

    hash: str
    original_name: str
    user: FoundUser


@dataclass
class ContactSyncResult:
    """Результат синхронизации контактов."""

    found: list[FoundContact]
    found_count: int
    pending_count: int


class ContactSyncService:
    """
    Сервис синхронизации контактов.

    Использует Privacy-First подход:
    1. Клиент хеширует номера телефонов (SHA-256) перед отправкой
    2. Сервер НИКОГДА не видит реальные номера
    3. Сравнение только по хешам
    """

    def __init__(self, user_repository: UserRepositoryInterface):
        self._user_repo = user_repository

    async def sync_contacts(
        self,
        owner_id: UUID,
        hashed_contacts: list[HashedContact],
    ) -> ContactSyncResult:
        """
        Синхронизировать контакты по хешам телефонов.

        Args:
            owner_id: ID владельца контактов
            hashed_contacts: Список контактов с хешами телефонов

        Returns:
            ContactSyncResult с найденными пользователями и количеством pending
        """
        if not hashed_contacts:
            return ContactSyncResult(found=[], found_count=0, pending_count=0)

        # Получаем все хеши
        hashes = [c.hash for c in hashed_contacts]
        hash_to_name = {c.hash: c.name for c in hashed_contacts}

        # Ищем пользователей по хешам
        found_users = await self._user_repo.find_by_phone_hashes(hashes)

        # Формируем результат
        found_contacts = []
        found_hashes = set()

        for user in found_users:
            if user.phone_hash and user.phone_hash in hash_to_name:
                found_hashes.add(user.phone_hash)
                found_contacts.append(
                    FoundContact(
                        hash=user.phone_hash,
                        original_name=hash_to_name[user.phone_hash],
                        user=FoundUser(
                            id=user.id,
                            name=user.full_name,
                            avatar_url=user.avatar_url,
                        ),
                    )
                )

        # Хеши, которые не найдены — pending (для будущих уведомлений)
        pending_count = len(hashes) - len(found_hashes)

        # TODO: Сохранить pending_hashes для уведомлений при регистрации
        # await self._pending_repo.save_pending(owner_id, list(set(hashes) - found_hashes))

        return ContactSyncResult(
            found=found_contacts,
            found_count=len(found_contacts),
            pending_count=pending_count,
        )
