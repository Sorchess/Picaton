from uuid import UUID

from domain.entities.saved_contact import SavedContact
from domain.entities.user import User
from domain.entities.business_card import BusinessCard
from domain.exceptions import (
    UserNotFoundError,
    ContactNotFoundError,
    ContactAlreadyExistsError,
)
from domain.repositories.saved_contact import SavedContactRepositoryInterface
from domain.repositories.user import UserRepositoryInterface
from domain.repositories.business_card import BusinessCardRepositoryInterface


class BusinessCardNotFoundError(Exception):
    """Карточка не найдена."""

    def __init__(self, card_id: str):
        self.card_id = card_id
        super().__init__(f"Business card not found: {card_id}")


class SavedContactService:
    """Сервис управления сохраненными контактами."""

    def __init__(
        self,
        contact_repository: SavedContactRepositoryInterface,
        user_repository: UserRepositoryInterface,
        card_repository: BusinessCardRepositoryInterface | None = None,
    ):
        self._contact_repository = contact_repository
        self._user_repository = user_repository
        self._card_repository = card_repository

    async def save_card_contact(
        self,
        owner_id: UUID,
        card_id: UUID,
        search_tags: list[str] | None = None,
        notes: str | None = None,
    ) -> SavedContact:
        """
        Сохранить контакт по визитной карточке.
        Сохраняет конкретную карточку пользователя.
        """
        if not self._card_repository:
            raise ValueError("Card repository not configured")

        # Проверяем, что карточка существует
        card = await self._card_repository.get_by_id(card_id)
        if not card:
            raise BusinessCardNotFoundError(str(card_id))

        # Проверяем, не сохранена ли уже эта карточка
        existing = await self._contact_repository.get_by_owner(owner_id)
        for c in existing:
            if c.saved_card_id == card_id:
                raise ContactAlreadyExistsError(str(card_id))

        # Получаем данные владельца карточки для email
        user = await self._user_repository.get_by_id(card.owner_id)

        # Парсим имя из display_name или берём из user
        first_name = ""
        last_name = ""
        if card.display_name:
            parts = card.display_name.split(" ", 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ""
        elif user:
            first_name = user.first_name
            last_name = user.last_name

        contact = SavedContact(
            owner_id=owner_id,
            saved_user_id=card.owner_id,
            saved_card_id=card_id,
            name=card.display_name or (user.full_name if user else ""),
            first_name=first_name,
            last_name=last_name,
            email=user.email if user else None,
            avatar_url=card.avatar_url or (user.avatar_url if user else None),
            contacts=list(card.contacts),  # Копируем контакты из карточки
            search_tags=search_tags or [],
            notes=notes,
            source="app",
        )

        # Добавляем теги карточки как теги поиска
        for tag in card.search_tags:
            contact.add_search_tag(tag)

        return await self._contact_repository.create(contact)

    async def save_user_contact(
        self,
        owner_id: UUID,
        user_id: UUID,
        card_id: UUID | None = None,
        search_tags: list[str] | None = None,
        notes: str | None = None,
    ) -> SavedContact:
        """
        Сохранить контакт другого пользователя.
        Если передан card_id, сохраняет конкретную карточку.
        Если card_id не передан, ищет основную карточку пользователя.
        """
        # Если передан card_id, используем новый метод
        if card_id and self._card_repository:
            return await self.save_card_contact(owner_id, card_id, search_tags, notes)

        # Проверяем, что пользователь существует
        user = await self._user_repository.get_by_id(user_id)
        if not user:
            raise UserNotFoundError(str(user_id))

        # Проверяем, не сохранен ли уже
        if await self._contact_repository.exists(owner_id, user_id):
            raise ContactAlreadyExistsError(str(user_id))

        # Пытаемся найти основную карточку пользователя для получения контактов и аватарки
        contacts_to_save = list(user.contacts)
        user_search_tags = list(user.search_tags)
        avatar_url = user.avatar_url

        if self._card_repository:
            cards = await self._card_repository.get_by_owner(user_id)
            if cards:
                primary_card = cards[0]
                if not contacts_to_save:
                    # Если у пользователя нет контактов, берём из карточки
                    contacts_to_save = list(primary_card.contacts)
                    # Также добавляем теги из карточки
                    user_search_tags = list(
                        set(user_search_tags + primary_card.search_tags)
                    )
                if not avatar_url and primary_card.avatar_url:
                    avatar_url = primary_card.avatar_url

        contact = SavedContact(
            owner_id=owner_id,
            saved_user_id=user_id,
            name=user.full_name,
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            avatar_url=avatar_url,
            contacts=contacts_to_save,  # Копируем контакты пользователя или из карточки
            search_tags=search_tags or [],
            notes=notes,
            source="app",
        )

        # Добавляем теги пользователя как теги поиска
        for tag in user_search_tags:
            contact.add_search_tag(tag)

        return await self._contact_repository.create(contact)

    async def add_manual_contact(
        self,
        owner_id: UUID,
        first_name: str,
        last_name: str,
        search_tags: list[str],
        phone: str | None = None,
        email: str | None = None,
        notes: str | None = None,
        messenger_type: str | None = None,
        messenger_value: str | None = None,
        name: str | None = None,  # Legacy, для обратной совместимости
    ) -> SavedContact:
        """
        Добавить контакт вручную с облаком тегов для поиска.
        """
        # Если передано только name (legacy), разбиваем на first_name и last_name
        if name and not first_name and not last_name:
            parts = name.split(" ", 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ""

        full_name = f"{first_name} {last_name}".strip()

        contact = SavedContact(
            owner_id=owner_id,
            name=full_name,
            first_name=first_name or "",
            last_name=last_name or "",
            phone=phone,
            email=email,
            notes=notes,
            messenger_type=messenger_type,
            messenger_value=messenger_value,
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
            raise ContactNotFoundError(str(contact_id))

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
            raise ContactNotFoundError(str(contact_id))

        contact.update_notes(notes)
        return await self._contact_repository.update(contact)

    async def update_contact(
        self,
        contact_id: UUID,
        first_name: str | None = None,
        last_name: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        messenger_type: str | None = None,
        messenger_value: str | None = None,
        notes: str | None = None,
        search_tags: list[str] | None = None,
    ) -> SavedContact:
        """Полное обновление данных контакта."""
        contact = await self._contact_repository.get_by_id(contact_id)
        if not contact:
            raise ContactNotFoundError(str(contact_id))

        contact.update(
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
            messenger_type=messenger_type,
            messenger_value=messenger_value,
            notes=notes,
            search_tags=search_tags,
        )
        return await self._contact_repository.update(contact)

    async def delete_contact(self, contact_id: UUID) -> bool:
        """Удалить контакт."""
        return await self._contact_repository.delete(contact_id)

    async def get_linked_user(self, contact: SavedContact) -> User | None:
        """Получить пользователя, связанного с контактом."""
        if not contact.saved_user_id:
            return None
        return await self._user_repository.get_by_id(contact.saved_user_id)
