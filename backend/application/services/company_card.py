"""
Сервис для управления корпоративными карточками.

Обеспечивает:
- Создание и редактирование карточек сотрудников
- Валидацию обязательных тегов согласно настройкам компании
- Поиск по карточкам
"""

from uuid import UUID

from domain.entities.company_card import CompanyCard, MissingRequiredTagError
from domain.entities.company_settings import CompanyTagSettings
from domain.entities.tag import Tag
from domain.enums.permission import Permission
from domain.repositories.company_card import ICompanyCardRepository
from domain.repositories.company_tag_settings import ICompanyTagSettingsRepository
from domain.values.contact import Contact


class CompanyCardNotFoundError(Exception):
    """Карточка не найдена."""
    pass


class CardAlreadyExistsError(Exception):
    """У пользователя уже есть карточка в этой компании."""
    pass


class InvalidTagValueError(Exception):
    """Невалидное значение тега."""
    
    def __init__(self, tag_name: str, message: str):
        self.tag_name = tag_name
        super().__init__(f"Тег '{tag_name}': {message}")


class CompanyCardService:
    """Сервис управления корпоративными карточками."""

    def __init__(
        self,
        card_repo: ICompanyCardRepository,
        tag_settings_repo: ICompanyTagSettingsRepository,
    ):
        self._card_repo = card_repo
        self._tag_settings_repo = tag_settings_repo

    async def create_card(
        self,
        company_id: UUID,
        member_id: UUID,
        user_id: UUID,
        company_name: str,
        display_name: str,
        position: str | None = None,
        department: str | None = None,
        avatar_url: str | None = None,
        bio: str | None = None,
        custom_tag_values: dict[str, str] | None = None,
    ) -> CompanyCard:
        """
        Создать корпоративную карточку для сотрудника.
        
        У каждого сотрудника может быть только ОДНА карточка в компании.
        """
        # Проверяем, нет ли уже карточки
        existing = await self._card_repo.get_by_company_and_user(company_id, user_id)
        if existing:
            raise CardAlreadyExistsError(
                f"У пользователя уже есть карточка в компании"
            )

        # Получаем настройки тегов компании
        tag_settings = await self._tag_settings_repo.get_by_company(company_id)
        
        # Создаём карточку
        card = CompanyCard(
            company_id=company_id,
            member_id=member_id,
            user_id=user_id,
            company_name=company_name,
            display_name=display_name,
            position=position,
            department=department,
            avatar_url=avatar_url,
            bio=bio,
            custom_tag_values=custom_tag_values or {},
        )

        # Валидируем обязательные теги если есть настройки
        if tag_settings:
            self._validate_card_tags(card, tag_settings)

        # Обновляем поисковые теги и полноту
        card._update_search_tags()
        card.calculate_completeness()

        return await self._card_repo.create(card)

    async def get_card(self, card_id: UUID) -> CompanyCard:
        """Получить карточку по ID."""
        card = await self._card_repo.get_by_id(card_id)
        if not card:
            raise CompanyCardNotFoundError(f"Карточка {card_id} не найдена")
        return card

    async def get_user_card_in_company(
        self, company_id: UUID, user_id: UUID
    ) -> CompanyCard | None:
        """Получить карточку пользователя в компании."""
        return await self._card_repo.get_by_company_and_user(company_id, user_id)

    async def get_company_cards(
        self,
        company_id: UUID,
        include_inactive: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CompanyCard]:
        """Получить все карточки компании."""
        return await self._card_repo.get_by_company(
            company_id, include_inactive, limit, offset
        )

    async def update_card(
        self,
        card_id: UUID,
        position: str | None = None,
        department: str | None = None,
        display_name: str | None = None,
        avatar_url: str | None = None,
        bio: str | None = None,
        custom_tag_values: dict[str, str] | None = None,
    ) -> CompanyCard:
        """Обновить карточку."""
        card = await self.get_card(card_id)

        if display_name is not None:
            card.update_display_name(display_name)
        if position is not None:
            card.update_position(position)
        if department is not None:
            card.update_department(department)
        if avatar_url is not None:
            card.update_avatar(avatar_url)
        if bio is not None:
            card.update_bio(bio)
        if custom_tag_values is not None:
            for tag_id, value in custom_tag_values.items():
                card.set_custom_tag(tag_id, value)

        # Получаем настройки и валидируем
        tag_settings = await self._tag_settings_repo.get_by_company(card.company_id)
        if tag_settings:
            self._validate_card_tags(card, tag_settings)

        card.calculate_completeness()
        return await self._card_repo.update(card)

    async def add_tag(self, card_id: UUID, tag: Tag) -> CompanyCard:
        """Добавить тег навыка к карточке."""
        card = await self.get_card(card_id)
        card.add_tag(tag)
        card.calculate_completeness()
        return await self._card_repo.update(card)

    async def remove_tag(self, card_id: UUID, tag_name: str) -> CompanyCard:
        """Удалить тег навыка с карточки."""
        card = await self.get_card(card_id)
        card.remove_tag(tag_name)
        card.calculate_completeness()
        return await self._card_repo.update(card)

    async def add_contact(self, card_id: UUID, contact: Contact) -> CompanyCard:
        """Добавить контакт к карточке."""
        card = await self.get_card(card_id)
        card.add_contact(contact)
        return await self._card_repo.update(card)

    async def remove_contact(
        self, card_id: UUID, contact: Contact
    ) -> CompanyCard:
        """Удалить контакт с карточки."""
        card = await self.get_card(card_id)
        card.remove_contact(contact.type, contact.value)
        return await self._card_repo.update(card)

    async def set_visibility(
        self, card_id: UUID, is_public: bool
    ) -> CompanyCard:
        """Установить видимость карточки вне компании."""
        card = await self.get_card(card_id)
        card.set_public(is_public)
        return await self._card_repo.update(card)

    async def deactivate_card(self, card_id: UUID) -> CompanyCard:
        """Деактивировать карточку."""
        card = await self.get_card(card_id)
        card.deactivate()
        return await self._card_repo.update(card)

    async def activate_card(self, card_id: UUID) -> CompanyCard:
        """Активировать карточку."""
        card = await self.get_card(card_id)
        card.activate()
        return await self._card_repo.update(card)

    async def delete_card(self, card_id: UUID) -> bool:
        """Удалить карточку."""
        return await self._card_repo.delete(card_id)

    async def search_cards(
        self,
        company_id: UUID,
        query: str | None = None,
        tags: list[str] | None = None,
        position: str | None = None,
        department: str | None = None,
        limit: int = 50,
    ) -> list[CompanyCard]:
        """Поиск карточек в компании."""
        if position:
            return await self._card_repo.get_by_position(company_id, position)
        if department:
            return await self._card_repo.get_by_department(company_id, department)
        if tags:
            return await self._card_repo.search_by_tags(company_id, tags, limit)
        if query:
            return await self._card_repo.search_by_text(company_id, query, limit)
        
        # Если нет фильтров — возвращаем все
        return await self._card_repo.get_by_company(company_id, limit=limit)

    async def semantic_search(
        self,
        company_id: UUID,
        embedding: list[float],
        limit: int = 10,
    ) -> list[CompanyCard]:
        """Семантический поиск по карточкам."""
        return await self._card_repo.search_by_embedding(
            company_id, embedding, limit
        )

    async def set_embedding(
        self, card_id: UUID, embedding: list[float]
    ) -> CompanyCard:
        """Установить embedding для семантического поиска."""
        card = await self.get_card(card_id)
        card.set_embedding(embedding)
        return await self._card_repo.update(card)

    def _validate_card_tags(
        self, card: CompanyCard, settings: CompanyTagSettings
    ) -> None:
        """Валидировать теги карточки согласно настройкам компании."""
        # Проверяем название компании
        if settings.company_tag.is_required and settings.company_tag.is_enabled:
            if not card.company_name:
                raise MissingRequiredTagError(
                    settings.company_tag.display_name or "Название компании"
                )

        # Проверяем должность
        if settings.position_tag.is_required and settings.position_tag.is_enabled:
            if not card.position:
                raise MissingRequiredTagError(
                    settings.position_tag.display_name or "Должность"
                )
            # Проверяем, что значение из списка опций
            if settings.position_tag.restrict_to_options:
                if not settings.validate_option("position_tag", card.position):
                    raise InvalidTagValueError(
                        "Должность",
                        f"Значение должно быть из списка: {settings.position_tag.options}"
                    )

        # Проверяем отдел
        if settings.department_tag.is_required and settings.department_tag.is_enabled:
            if not card.department:
                raise MissingRequiredTagError(
                    settings.department_tag.display_name or "Отдел"
                )
            # Проверяем, что значение из списка опций
            if settings.department_tag.restrict_to_options:
                if not settings.validate_option("department_tag", card.department):
                    raise InvalidTagValueError(
                        "Отдел",
                        f"Значение должно быть из списка: {settings.department_tag.options}"
                    )

        # Проверяем кастомные теги
        for tag_id, tag_settings in settings.custom_tags.items():
            if tag_settings.is_required and tag_settings.is_enabled:
                value = card.custom_tag_values.get(tag_id)
                if not value:
                    raise MissingRequiredTagError(
                        tag_settings.display_name or tag_id
                    )
                # Проверяем, что значение из списка опций
                if tag_settings.restrict_to_options:
                    if not settings.validate_option(tag_id, value):
                        raise InvalidTagValueError(
                            tag_settings.display_name or tag_id,
                            f"Значение должно быть из списка: {tag_settings.options}"
                        )


class CompanyTagSettingsService:
    """Сервис управления настройками тегов компании."""

    def __init__(self, repo: ICompanyTagSettingsRepository):
        self._repo = repo

    async def get_settings(self, company_id: UUID) -> CompanyTagSettings | None:
        """Получить настройки тегов компании."""
        return await self._repo.get_by_company(company_id)

    async def get_or_create_settings(self, company_id: UUID) -> CompanyTagSettings:
        """Получить или создать настройки тегов для компании."""
        settings = await self._repo.get_by_company(company_id)
        if not settings:
            settings = CompanyTagSettings.create_default(company_id)
            settings = await self._repo.create(settings)
        return settings

    async def update_settings(
        self,
        company_id: UUID,
        company_tag_required: bool | None = None,
        position_tag_required: bool | None = None,
        position_tag_options: list[str] | None = None,
        position_restrict_to_options: bool | None = None,
        department_tag_required: bool | None = None,
        department_tag_options: list[str] | None = None,
        department_restrict_to_options: bool | None = None,
    ) -> CompanyTagSettings:
        """Обновить настройки основных тегов."""
        settings = await self.get_or_create_settings(company_id)

        if company_tag_required is not None:
            settings.company_tag.is_required = company_tag_required
        
        if position_tag_required is not None:
            settings.position_tag.is_required = position_tag_required
        if position_tag_options is not None:
            settings.position_tag.options = position_tag_options
        if position_restrict_to_options is not None:
            settings.position_tag.restrict_to_options = position_restrict_to_options

        if department_tag_required is not None:
            settings.department_tag.is_required = department_tag_required
        if department_tag_options is not None:
            settings.department_tag.options = department_tag_options
        if department_restrict_to_options is not None:
            settings.department_tag.restrict_to_options = department_restrict_to_options

        settings.mark_updated()
        return await self._repo.update(settings)

    async def add_custom_tag(
        self,
        company_id: UUID,
        tag_id: str,
        display_name: str,
        is_required: bool = False,
        placeholder: str | None = None,
        options: list[str] | None = None,
        restrict_to_options: bool = False,
    ) -> CompanyTagSettings:
        """Добавить кастомный тег."""
        settings = await self.get_or_create_settings(company_id)
        settings.add_custom_tag(
            tag_id=tag_id,
            display_name=display_name,
            is_required=is_required,
            placeholder=placeholder,
            options=options,
            restrict_to_options=restrict_to_options,
        )
        return await self._repo.update(settings)

    async def update_custom_tag(
        self,
        company_id: UUID,
        tag_id: str,
        display_name: str | None = None,
        is_required: bool | None = None,
        placeholder: str | None = None,
        options: list[str] | None = None,
        restrict_to_options: bool | None = None,
    ) -> CompanyTagSettings:
        """Обновить кастомный тег."""
        settings = await self.get_or_create_settings(company_id)
        settings.update_custom_tag(
            tag_id=tag_id,
            display_name=display_name,
            is_required=is_required,
            placeholder=placeholder,
            options=options,
            restrict_to_options=restrict_to_options,
        )
        return await self._repo.update(settings)

    async def remove_custom_tag(
        self, company_id: UUID, tag_id: str
    ) -> CompanyTagSettings:
        """Удалить кастомный тег."""
        settings = await self.get_or_create_settings(company_id)
        settings.remove_custom_tag(tag_id)
        return await self._repo.update(settings)

    async def delete_settings(self, company_id: UUID) -> bool:
        """Удалить настройки тегов компании."""
        return await self._repo.delete_by_company(company_id)
