from uuid import UUID

from domain.entities.saved_contact import SavedContact
from domain.entities.user import User
from domain.repositories.saved_contact import SavedContactRepositoryInterface
from domain.repositories.user import UserRepositoryInterface


class SavedContactService:
    """Сервис управления сохраненными контактами."""

    def __init__(
        self,
        contact_repository: SavedContactRepositoryInterface,
        user_repository: UserRepositoryInterface,
    ):
        self._contact_repository = contact_repository
        self._user_repository = user_repository

    async def save_user_contact(
        self,
        owner_id: UUID,
        user_id: UUID,
        search_tags: list[str] | None = None,
        notes: str | None = None,
    ) -> SavedContact:
        """
        Сохранить контакт другого пользователя.
        """
        # Проверяем, что пользователь существует
        user = await self._user_repository.get_by_id(user_id)
        if not user:
            raise ValueError(f"User {user_id} not found")

        # Проверяем, не сохранен ли уже
        if await self._contact_repository.exists(owner_id, user_id):
            raise ValueError("Contact already saved")

        contact = SavedContact(
            owner_id=owner_id,
            saved_user_id=user_id,
            name=user.full_name,
            email=user.email,
            search_tags=search_tags or [],
            notes=notes,
            source="app",
        )

        # Добавляем теги пользователя как теги поиска
        for tag in user.search_tags:
            contact.add_search_tag(tag)

        return await self._contact_repository.create(contact)

    async def add_manual_contact(
        self,
        owner_id: UUID,
        name: str,
        search_tags: list[str],
        phone: str | None = None,
        email: str | None = None,
        notes: str | None = None,
    ) -> SavedContact:
        """
        Добавить контакт вручную с облаком тегов для поиска.
        """
        contact = SavedContact(
            owner_id=owner_id,
            name=name,
            phone=phone,
            email=email,
            notes=notes,
            search_tags=[t.lower().strip() for t in search_tags if t.strip()],
            source="manual",
        )

        return await self._contact_repository.create(contact)

    async def get_contact(self, contact_id: UUID) -> SavedContact | None:
        """Получить контакт по ID."""
        return await self._contact_repository.get_by_id(contact_id)

    async def get_user_contacts(
        self,
        owner_id: UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> list[SavedContact]:
        """Получить все контакты пользователя."""
        return await self._contact_repository.get_by_owner(owner_id, skip, limit)

    async def update_contact_tags(
        self,
        contact_id: UUID,
        tags: list[str],
    ) -> SavedContact:
        """Обновить теги контакта."""
        contact = await self._contact_repository.get_by_id(contact_id)
        if not contact:
            raise ValueError(f"Contact {contact_id} not found")

        contact.set_search_tags(tags)
        return await self._contact_repository.update(contact)

    async def update_contact_notes(
        self,
        contact_id: UUID,
        notes: str | None,
    ) -> SavedContact:
        """Обновить заметки о контакте."""
        contact = await self._contact_repository.get_by_id(contact_id)
        if not contact:
            raise ValueError(f"Contact {contact_id} not found")

        contact.update_notes(notes)
        return await self._contact_repository.update(contact)

    async def delete_contact(self, contact_id: UUID) -> bool:
        """Удалить контакт."""
        return await self._contact_repository.delete(contact_id)

    async def get_linked_user(self, contact: SavedContact) -> User | None:
        """Получить пользователя, связанного с контактом."""
        if not contact.saved_user_id:
            return None
        return await self._user_repository.get_by_id(contact.saved_user_id)
