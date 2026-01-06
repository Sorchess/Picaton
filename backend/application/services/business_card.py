"""Сервис управления визитными карточками."""

from uuid import UUID

from domain.entities.business_card import BusinessCard
from domain.entities.tag import Tag
from domain.enums.contact import ContactType
from domain.values.contact import Contact
from domain.repositories.business_card import BusinessCardRepositoryInterface
from domain.repositories.user import UserRepositoryInterface
from domain.exceptions.base import NotFoundError


class BusinessCardNotFoundError(NotFoundError):
    """Карточка не найдена."""

    def __init__(self, card_id: str):
        super().__init__(f"Business card not found: {card_id}")


class CardLimitExceededError(Exception):
    """Превышен лимит карточек."""

    def __init__(self, limit: int):
        super().__init__(f"Maximum number of cards ({limit}) reached")


class CardAccessDeniedError(Exception):
    """Нет доступа к карточке."""

    def __init__(self, card_id: str, owner_id: str):
        super().__init__(f"Access denied to card {card_id} for user {owner_id}")


MAX_CARDS_PER_USER = 5


class BusinessCardService:
    """Сервис управления визитными карточками."""

    def __init__(
        self,
        card_repository: BusinessCardRepositoryInterface,
        user_repository: UserRepositoryInterface | None = None,
    ):
        self._card_repository = card_repository
        self._user_repository = user_repository

    async def get_card(self, card_id: UUID) -> BusinessCard:
        """Получить карточку по ID."""
        card = await self._card_repository.get_by_id(card_id)
        if not card:
            raise BusinessCardNotFoundError(str(card_id))
        return card

    async def get_user_cards(self, owner_id: UUID) -> list[BusinessCard]:
        """Получить все карточки пользователя."""
        return await self._card_repository.get_by_owner(owner_id)

    async def get_primary_card(self, owner_id: UUID) -> BusinessCard | None:
        """Получить основную карточку пользователя."""
        return await self._card_repository.get_primary_by_owner(owner_id)

    async def create_card(
        self,
        owner_id: UUID,
        title: str = "Основная",
        display_name: str = "",
        is_primary: bool = False,
        bio: str | None = None,
        avatar_url: str | None = None,
        contacts: list[Contact] | None = None,
    ) -> BusinessCard:
        """Создать новую карточку."""
        # Проверяем лимит карточек
        count = await self._card_repository.count_by_owner(owner_id)
        if count >= MAX_CARDS_PER_USER:
            raise CardLimitExceededError(MAX_CARDS_PER_USER)

        # Если это первая карточка - делаем её основной
        if count == 0:
            is_primary = True

        # Если display_name не указан - получаем имя пользователя
        if not display_name and self._user_repository:
            user = await self._user_repository.get_by_id(owner_id)
            if user:
                display_name = f"{user.first_name} {user.last_name}".strip()

        card = BusinessCard(
            owner_id=owner_id,
            title=title,
            display_name=display_name,
            is_primary=is_primary,
            bio=bio,
            avatar_url=avatar_url,
            contacts=contacts or [],
        )

        created_card = await self._card_repository.create(card)

        # Если карточка основная - сбрасываем флаг у остальных
        if is_primary and count > 0:
            await self._card_repository.set_primary(owner_id, created_card.id)

        return created_card

    async def update_card(
        self,
        card_id: UUID,
        owner_id: UUID,
        title: str | None = None,
        display_name: str | None = None,
        avatar_url: str | None = None,
        bio: str | None = None,
        is_active: bool | None = None,
    ) -> BusinessCard:
        """Обновить карточку."""
        card = await self.get_card(card_id)

        # Проверяем владельца
        if card.owner_id != owner_id:
            raise CardAccessDeniedError(str(card_id), str(owner_id))

        if title is not None:
            card.update_title(title)
        if display_name is not None:
            card.update_display_name(display_name)
        if avatar_url is not None:
            card.update_avatar(avatar_url)
        if bio is not None:
            card.update_bio(bio)
        if is_active is not None:
            card.set_active(is_active)

        return await self._card_repository.update(card)

    async def delete_card(self, card_id: UUID, owner_id: UUID) -> bool:
        """Удалить карточку."""
        card = await self.get_card(card_id)

        # Проверяем владельца
        if card.owner_id != owner_id:
            raise CardAccessDeniedError(str(card_id), str(owner_id))

        # Нельзя удалить последнюю карточку
        count = await self._card_repository.count_by_owner(owner_id)
        if count <= 1:
            raise Exception("Cannot delete the last card")

        was_primary = card.is_primary
        result = await self._card_repository.delete(card_id)

        # Если удалили основную - делаем первую оставшуюся основной
        if was_primary and result:
            cards = await self._card_repository.get_by_owner(owner_id)
            if cards:
                await self._card_repository.set_primary(owner_id, cards[0].id)

        return result

    async def set_primary(self, card_id: UUID, owner_id: UUID) -> bool:
        """Установить карточку как основную."""
        card = await self.get_card(card_id)

        # Проверяем владельца
        if card.owner_id != owner_id:
            raise CardAccessDeniedError(str(card_id), str(owner_id))

        return await self._card_repository.set_primary(owner_id, card_id)

    async def update_visibility_for_owner(self, owner_id: UUID, is_public: bool) -> int:
        """
        Обновить видимость всех карточек пользователя.

        Args:
            owner_id: ID владельца карточек
            is_public: True - публичные (видны в поиске), False - приватные (только в компании)

        Returns:
            Количество обновлённых карточек
        """
        return await self._card_repository.update_visibility_by_owner(
            owner_id, is_public
        )

    async def update_avatar_for_owner(
        self, owner_id: UUID, avatar_url: str | None
    ) -> int:
        """
        Обновить аватарку во всех карточках пользователя.

        Args:
            owner_id: ID владельца карточек
            avatar_url: Новый URL аватарки

        Returns:
            Количество обновлённых карточек
        """
        return await self._card_repository.update_avatar_by_owner(owner_id, avatar_url)

    # ============ Контакты ============

    async def add_contact(
        self,
        card_id: UUID,
        owner_id: UUID,
        contact_type: str,
        value: str,
        is_primary: bool = False,
        is_visible: bool = True,
    ) -> BusinessCard:
        """Добавить контакт в карточку."""
        card = await self.get_card(card_id)

        if card.owner_id != owner_id:
            raise CardAccessDeniedError(str(card_id), str(owner_id))

        try:
            ctype = ContactType(contact_type.upper())
        except ValueError:
            raise ValueError(f"Invalid contact type: {contact_type}")

        card.add_contact(ctype, value, is_primary, is_visible)
        return await self._card_repository.update(card)

    async def remove_contact(
        self,
        card_id: UUID,
        owner_id: UUID,
        contact_type: str,
        value: str,
    ) -> BusinessCard:
        """Удалить контакт из карточки."""
        card = await self.get_card(card_id)

        if card.owner_id != owner_id:
            raise CardAccessDeniedError(str(card_id), str(owner_id))

        try:
            ctype = ContactType(contact_type.upper())
        except ValueError:
            raise ValueError(f"Invalid contact type: {contact_type}")

        card.remove_contact(ctype, value)
        return await self._card_repository.update(card)

    async def update_contact_visibility(
        self,
        card_id: UUID,
        owner_id: UUID,
        contact_type: str,
        value: str,
        is_visible: bool,
    ) -> BusinessCard:
        """Обновить видимость контакта."""
        card = await self.get_card(card_id)

        if card.owner_id != owner_id:
            raise CardAccessDeniedError(str(card_id), str(owner_id))

        try:
            ctype = ContactType(contact_type.upper())
        except ValueError:
            raise ValueError(f"Invalid contact type: {contact_type}")

        card.update_contact_visibility(ctype, value, is_visible)
        return await self._card_repository.update(card)

    # ============ Теги ============

    async def set_search_tags(
        self,
        card_id: UUID,
        owner_id: UUID,
        tags: list[str],
    ) -> BusinessCard:
        """Установить теги для поиска."""
        card = await self.get_card(card_id)

        if card.owner_id != owner_id:
            raise CardAccessDeniedError(str(card_id), str(owner_id))

        card.set_search_tags(tags)
        return await self._card_repository.update(card)

    async def add_tag(
        self,
        card_id: UUID,
        owner_id: UUID,
        tag: Tag,
    ) -> BusinessCard:
        """Добавить тег навыка."""
        card = await self.get_card(card_id)

        if card.owner_id != owner_id:
            raise CardAccessDeniedError(str(card_id), str(owner_id))

        card.add_tag(tag)
        return await self._card_repository.update(card)

    async def remove_tag(
        self,
        card_id: UUID,
        owner_id: UUID,
        tag: Tag,
    ) -> BusinessCard:
        """Удалить тег навыка."""
        card = await self.get_card(card_id)

        if card.owner_id != owner_id:
            raise CardAccessDeniedError(str(card_id), str(owner_id))

        card.remove_tag(tag)
        return await self._card_repository.update(card)

    # ============ Random Facts ============

    async def add_random_fact(
        self,
        card_id: UUID,
        owner_id: UUID,
        fact: str,
    ) -> BusinessCard:
        """Добавить рандомный факт."""
        card = await self.get_card(card_id)

        if card.owner_id != owner_id:
            raise CardAccessDeniedError(str(card_id), str(owner_id))

        card.add_random_fact(fact)
        return await self._card_repository.update(card)

    async def remove_random_fact(
        self,
        card_id: UUID,
        owner_id: UUID,
        fact: str,
    ) -> BusinessCard:
        """Удалить рандомный факт."""
        card = await self.get_card(card_id)

        if card.owner_id != owner_id:
            raise CardAccessDeniedError(str(card_id), str(owner_id))

        card.remove_random_fact(fact)
        return await self._card_repository.update(card)

    # ============ AI Bio ============

    async def set_ai_generated_bio(
        self,
        card_id: UUID,
        owner_id: UUID,
        bio: str,
    ) -> BusinessCard:
        """Установить AI-сгенерированную презентацию."""
        card = await self.get_card(card_id)

        if card.owner_id != owner_id:
            raise CardAccessDeniedError(str(card_id), str(owner_id))

        card.set_ai_generated_bio(bio)
        return await self._card_repository.update(card)

    async def clear_content(
        self,
        card_id: UUID,
        owner_id: UUID,
    ) -> BusinessCard:
        """Очистить всё содержимое карточки."""
        card = await self.get_card(card_id)

        if card.owner_id != owner_id:
            raise CardAccessDeniedError(str(card_id), str(owner_id))

        card.clear_content()
        return await self._card_repository.update(card)
