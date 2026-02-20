"""Сервис проверки доступа на основе настроек приватности."""

import logging
from uuid import UUID

from domain.enums.privacy import PrivacyLevel
from domain.entities.user import User
from domain.repositories.user import UserRepositoryInterface
from domain.repositories.saved_contact import SavedContactRepositoryInterface
from domain.repositories.company import CompanyMemberRepositoryInterface

logger = logging.getLogger(__name__)


class PrivacyAccessDeniedError(Exception):
    """Доступ запрещён настройками приватности."""

    def __init__(self, action: str, target_user_id: str):
        self.action = action
        self.target_user_id = target_user_id
        super().__init__(f"Privacy settings deny '{action}' for user {target_user_id}")


class PrivacyChecker:
    """Проверяет доступ между пользователями на основе настроек приватности."""

    def __init__(
        self,
        user_repo: UserRepositoryInterface,
        contact_repo: SavedContactRepositoryInterface,
        member_repo: CompanyMemberRepositoryInterface,
    ):
        self._user_repo = user_repo
        self._contact_repo = contact_repo
        self._member_repo = member_repo

    async def can_message(self, sender_id: UUID, recipient_id: UUID) -> bool:
        """Проверить, может ли sender отправить сообщение recipient."""
        recipient = await self._user_repo.get_by_id(recipient_id)
        if not recipient:
            return False
        return await self._check_access(
            sender_id, recipient_id, recipient.privacy_who_can_message
        )

    async def can_view_profile(self, viewer_id: UUID, target_id: UUID) -> bool:
        """Проверить, может ли viewer видеть профиль target.

        Контакты всегда могут видеть профиль независимо от настроек.
        """
        if viewer_id == target_id:
            return True
        target = await self._user_repo.get_by_id(target_id)
        if not target:
            return False
        # Контакты всегда видят профиль
        if await self._is_contact(target_id, viewer_id):
            return True
        return await self._check_access(
            viewer_id, target_id, target.privacy_who_can_see_profile
        )

    async def can_invite_to_company(self, inviter_id: UUID, target_id: UUID) -> bool:
        """Проверить, может ли inviter приглашать target в компанию."""
        target = await self._user_repo.get_by_id(target_id)
        if not target:
            return False
        return await self._check_access(
            inviter_id, target_id, target.privacy_who_can_invite
        )

    async def _check_access(
        self,
        actor_id: UUID,
        target_id: UUID,
        privacy_level: PrivacyLevel,
    ) -> bool:
        """
        Общая проверка доступа.

        Args:
            actor_id: ID пользователя, который хочет выполнить действие
            target_id: ID пользователя, к которому обращаются
            privacy_level: Уровень приватности целевого пользователя
        """
        if actor_id == target_id:
            return True

        if privacy_level == PrivacyLevel.ALL:
            return True

        if privacy_level == PrivacyLevel.NOBODY:
            return False

        if privacy_level == PrivacyLevel.CONTACTS:
            return await self._is_contact(target_id, actor_id)

        if privacy_level == PrivacyLevel.CONTACTS_OF_CONTACTS:
            if await self._is_contact(target_id, actor_id):
                return True
            return await self._is_contact_of_contact(target_id, actor_id)

        if privacy_level == PrivacyLevel.COMPANY_COLLEAGUES:
            if await self._is_contact(target_id, actor_id):
                return True
            if await self._is_contact_of_contact(target_id, actor_id):
                return True
            return await self._share_company(actor_id, target_id)

        return False

    async def _is_contact(self, owner_id: UUID, contact_user_id: UUID) -> bool:
        """Проверить, является ли contact_user_id контактом owner_id."""
        return await self._contact_repo.exists(owner_id, contact_user_id)

    async def _is_contact_of_contact(self, target_id: UUID, actor_id: UUID) -> bool:
        """
        Проверить, является ли actor контактом контакта target.

        target -> свои контакты -> у каждого из них проверяем,
        есть ли actor среди их контактов.
        """
        # Получаем контакты target
        target_contacts = await self._contact_repo.get_by_owner(
            target_id, skip=0, limit=500
        )
        for sc in target_contacts:
            if sc.saved_user_id and await self._contact_repo.exists(
                sc.saved_user_id, actor_id
            ):
                return True
        return False

    async def _share_company(self, user_a: UUID, user_b: UUID) -> bool:
        """Проверить, состоят ли оба пользователя хотя бы в одной общей компании."""
        memberships_a = await self._member_repo.get_by_user(user_a)
        if not memberships_a:
            return False
        memberships_b = await self._member_repo.get_by_user(user_b)
        if not memberships_b:
            return False

        companies_a = {m.company_id for m in memberships_a}
        companies_b = {m.company_id for m in memberships_b}
        return bool(companies_a & companies_b)
