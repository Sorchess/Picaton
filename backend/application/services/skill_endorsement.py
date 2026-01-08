"""
Сервис для работы с подтверждениями навыков (skill endorsements).
"""

from dataclasses import dataclass
from uuid import UUID, uuid5, NAMESPACE_DNS
from hashlib import md5

from domain.entities.skill_endorsement import SkillEndorsement
from domain.repositories.skill_endorsement import SkillEndorsementRepositoryInterface
from domain.repositories.business_card import BusinessCardRepositoryInterface
from domain.repositories.user import UserRepositoryInterface


class EndorsementError(Exception):
    """Базовая ошибка эндорсментов."""

    pass


class CannotEndorseOwnSkillError(EndorsementError):
    """Нельзя подтверждать свои собственные навыки."""

    def __init__(self):
        super().__init__("Cannot endorse your own skills")


class AlreadyEndorsedError(EndorsementError):
    """Навык уже подтвержден этим пользователем."""

    def __init__(self):
        super().__init__("You have already endorsed this skill")


class CardNotFoundError(EndorsementError):
    """Карточка не найдена."""

    def __init__(self, card_id: UUID):
        super().__init__(f"Card {card_id} not found")


class TagNotFoundError(EndorsementError):
    """Навык не найден на карточке."""

    def __init__(self, tag_id: UUID):
        super().__init__(f"Tag {tag_id} not found on this card")


class EndorsementNotFoundError(EndorsementError):
    """Подтверждение не найдено."""

    def __init__(self):
        super().__init__("Endorsement not found")


@dataclass
class SkillWithEndorsements:
    """Навык с информацией о подтверждениях."""

    tag_id: UUID
    tag_name: str
    tag_category: str
    proficiency: int
    endorsement_count: int
    endorsed_by_current_user: bool
    endorsers: list[dict]  # Список endorser-ов {id, name, avatar_url}


@dataclass
class CardSkillsWithEndorsements:
    """Все навыки карточки с подтверждениями."""

    card_id: UUID
    skills: list[SkillWithEndorsements]


class SkillEndorsementService:
    """Сервис для управления подтверждениями навыков."""

    def __init__(
        self,
        endorsement_repository: SkillEndorsementRepositoryInterface,
        card_repository: BusinessCardRepositoryInterface,
        user_repository: UserRepositoryInterface,
    ):
        self._endorsement_repo = endorsement_repository
        self._card_repo = card_repository
        self._user_repo = user_repository

    async def endorse_skill(
        self,
        endorser_id: UUID,
        card_id: UUID,
        tag_id: UUID,
    ) -> SkillEndorsement:
        """
        Подтвердить навык пользователя.

        Args:
            endorser_id: ID пользователя, который подтверждает навык
            card_id: ID карточки с навыком
            tag_id: ID навыка для подтверждения

        Returns:
            Созданное подтверждение

        Raises:
            CannotEndorseOwnSkillError: Нельзя подтвердить свой навык
            AlreadyEndorsedError: Навык уже подтвержден
            CardNotFoundError: Карточка не найдена
            TagNotFoundError: Навык не найден
        """
        # Получить карточку
        card = await self._card_repo.get_by_id(card_id)
        if not card:
            raise CardNotFoundError(card_id)

        # Нельзя подтверждать свои навыки
        if card.owner_id == endorser_id:
            raise CannotEndorseOwnSkillError()

        # Проверить, что навык есть на карточке
        # Сначала ищем в card.tags
        tag = next((t for t in card.tags if t.id == tag_id), None)
        tag_name = tag.name if tag else None
        tag_category = tag.category if tag else None

        # Если не нашли в tags, ищем в search_tags по сгенерированному UUID
        if not tag and card.search_tags:
            for search_tag_name in card.search_tags:
                generated_id = uuid5(NAMESPACE_DNS, f"{card_id}:{search_tag_name}")
                if generated_id == tag_id:
                    tag_name = search_tag_name
                    tag_category = None
                    break

        if not tag_name:
            raise TagNotFoundError(tag_id)

        # Проверить, не подтверждал ли уже
        if await self._endorsement_repo.has_user_endorsed(endorser_id, card_id, tag_id):
            raise AlreadyEndorsedError()

        # Получить информацию о подтверждающем пользователе
        endorser = await self._user_repo.get_by_id(endorser_id)
        endorser_name = ""
        endorser_avatar = None
        if endorser:
            endorser_name = f"{endorser.first_name} {endorser.last_name}".strip()
            endorser_avatar = endorser.avatar_url

        # Создать подтверждение
        endorsement = SkillEndorsement(
            endorser_id=endorser_id,
            card_id=card_id,
            tag_id=tag_id,
            tag_name=tag_name,
            tag_category=tag_category,
            card_owner_id=card.owner_id,
            endorser_name=endorser_name,
            endorser_avatar_url=endorser_avatar,
        )

        return await self._endorsement_repo.create(endorsement)

    async def remove_endorsement(
        self,
        endorser_id: UUID,
        card_id: UUID,
        tag_id: UUID,
    ) -> bool:
        """
        Удалить подтверждение навыка (снять лайк).

        Returns:
            True если подтверждение было удалено

        Raises:
            EndorsementNotFoundError: Подтверждение не найдено
        """
        deleted = await self._endorsement_repo.delete(endorser_id, card_id, tag_id)
        if not deleted:
            raise EndorsementNotFoundError()
        return True

    async def get_card_skills_with_endorsements(
        self,
        card_id: UUID,
        current_user_id: UUID | None = None,
        contact_user_ids: list[UUID] | None = None,
    ) -> CardSkillsWithEndorsements:
        """
        Получить все навыки карточки с информацией о подтверждениях.

        Args:
            card_id: ID карточки
            current_user_id: ID текущего пользователя (для отметки "вы подтвердили")
            contact_user_ids: ID контактов пользователя (для фильтрации endorser-ов)

        Returns:
            Список навыков с количеством подтверждений
        """
        # Получить карточку
        card = await self._card_repo.get_by_id(card_id)
        if not card:
            raise CardNotFoundError(card_id)

        # Получить все подтверждения для карточки
        all_endorsements = await self._endorsement_repo.get_endorsements_for_card(
            card_id
        )

        # Сгруппировать по tag_id
        endorsements_by_tag: dict[str, list[SkillEndorsement]] = {}
        for e in all_endorsements:
            tag_id_str = str(e.tag_id)
            if tag_id_str not in endorsements_by_tag:
                endorsements_by_tag[tag_id_str] = []
            endorsements_by_tag[tag_id_str].append(e)

        # Собрать результат
        skills = []

        # Используем card.tags если они есть, иначе генерируем из search_tags
        if card.tags:
            for tag in card.tags:
                tag_id_str = str(tag.id)
                tag_endorsements = endorsements_by_tag.get(tag_id_str, [])

                # Проверить, подтвердил ли текущий пользователь
                endorsed_by_current = False
                if current_user_id:
                    endorsed_by_current = any(
                        e.endorser_id == current_user_id for e in tag_endorsements
                    )

                # Если есть список контактов, фильтруем только их
                if contact_user_ids:
                    contact_endorsements = [
                        e for e in tag_endorsements if e.endorser_id in contact_user_ids
                    ]
                    endorsers = [
                        {
                            "id": str(e.endorser_id),
                            "name": e.endorser_name,
                            "avatar_url": e.endorser_avatar_url,
                        }
                        for e in contact_endorsements[:5]
                    ]
                else:
                    endorsers = [
                        {
                            "id": str(e.endorser_id),
                            "name": e.endorser_name,
                            "avatar_url": e.endorser_avatar_url,
                        }
                        for e in tag_endorsements[:5]
                    ]

                skills.append(
                    SkillWithEndorsements(
                        tag_id=tag.id,
                        tag_name=tag.name,
                        tag_category=tag.category,
                        proficiency=tag.proficiency,
                        endorsement_count=len(tag_endorsements),
                        endorsed_by_current_user=endorsed_by_current,
                        endorsers=endorsers,
                    )
                )
        else:
            # Генерируем теги из search_tags с детерминированными UUID
            for tag_name in card.search_tags:
                # Генерируем стабильный UUID на основе card_id + tag_name
                tag_id = uuid5(NAMESPACE_DNS, f"{card_id}:{tag_name}")
                tag_id_str = str(tag_id)
                tag_endorsements = endorsements_by_tag.get(tag_id_str, [])

                # Проверить, подтвердил ли текущий пользователь
                endorsed_by_current = False
                if current_user_id:
                    endorsed_by_current = any(
                        e.endorser_id == current_user_id for e in tag_endorsements
                    )

                endorsers = [
                    {
                        "id": str(e.endorser_id),
                        "name": e.endorser_name,
                        "avatar_url": e.endorser_avatar_url,
                    }
                    for e in tag_endorsements[:5]
                ]

                skills.append(
                    SkillWithEndorsements(
                        tag_id=tag_id,
                        tag_name=tag_name,
                        tag_category="SKILL",  # Категория по умолчанию
                        proficiency=1,
                        endorsement_count=len(tag_endorsements),
                        endorsed_by_current_user=endorsed_by_current,
                        endorsers=endorsers,
                    )
                )

        return CardSkillsWithEndorsements(card_id=card_id, skills=skills)

    async def get_endorsements_from_contacts(
        self,
        card_id: UUID,
        tag_id: UUID,
        contact_user_ids: list[UUID],
    ) -> list[SkillEndorsement]:
        """
        Получить подтверждения от контактов пользователя.
        Полезно для показа "3 из ваших контактов подтвердили этот навык".
        """
        return await self._endorsement_repo.get_endorsers_from_contacts(
            card_id, tag_id, contact_user_ids
        )

    async def get_my_endorsements(
        self,
        user_id: UUID,
    ) -> list[SkillEndorsement]:
        """Получить все подтверждения, сделанные пользователем."""
        return await self._endorsement_repo.get_endorsements_by_user(user_id)

    async def toggle_endorsement(
        self,
        endorser_id: UUID,
        card_id: UUID,
        tag_id: UUID,
    ) -> tuple[bool, SkillEndorsement | None]:
        """
        Переключить состояние подтверждения (лайк/анлайк).

        Returns:
            (is_endorsed, endorsement) - состояние после операции и объект если был создан
        """
        existing = await self._endorsement_repo.get_by_endorser_and_tag(
            endorser_id, card_id, tag_id
        )

        if existing:
            # Убираем лайк
            await self._endorsement_repo.delete(endorser_id, card_id, tag_id)
            return (False, None)
        else:
            # Ставим лайк
            endorsement = await self.endorse_skill(endorser_id, card_id, tag_id)
            return (True, endorsement)
