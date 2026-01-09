"""Сервис управления компаниями и корпоративным пространством."""

import logging
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from domain.entities.company import Company, CompanyMember, CompanyInvitation
from domain.entities.company_role import CompanyRole
from domain.entities.user import User
from domain.enums.company import InvitationStatus
from domain.repositories.company import (
    CompanyRepositoryInterface,
    CompanyMemberRepositoryInterface,
    CompanyInvitationRepositoryInterface,
)
from domain.repositories.company_role import CompanyRoleRepositoryInterface
from domain.repositories.user import UserRepositoryInterface


logger = logging.getLogger(__name__)


# Исключения
class CompanyError(Exception):
    """Базовая ошибка компании."""

    pass


class CompanyNotFoundError(CompanyError):
    """Компания не найдена."""

    pass


class CompanyAlreadyExistsError(CompanyError):
    """Компания с таким доменом уже существует."""

    pass


class MemberNotFoundError(CompanyError):
    """Член компании не найден."""

    pass


class AlreadyMemberError(CompanyError):
    """Пользователь уже является членом компании."""

    pass


class InvitationNotFoundError(CompanyError):
    """Приглашение не найдено."""

    pass


class InvitationExpiredError(CompanyError):
    """Приглашение истекло."""

    pass


class InvitationAlreadyExistsError(CompanyError):
    """Приглашение для этого email уже существует."""

    pass


class PermissionDeniedError(CompanyError):
    """Недостаточно прав."""

    pass


class CannotRemoveOwnerError(CompanyError):
    """Нельзя удалить владельца."""

    pass


class CannotChangeOwnRoleError(CompanyError):
    """Нельзя изменить свою роль."""

    pass


# Конфигурация
INVITATION_EXPIRE_DAYS = 7  # Приглашение действует 7 дней
INVITATION_TOKEN_LENGTH = 32  # Длина токена приглашения


class CompanyService:
    """
    Сервис управления компаниями.

    ПРИМЕЧАНИЕ: Этот сервис использует упрощённые проверки прав для обратной совместимости.
    Для детального управления правами используйте CompanyRoleService и PermissionChecker.
    """

    def __init__(
        self,
        company_repo: CompanyRepositoryInterface,
        member_repo: CompanyMemberRepositoryInterface,
        invitation_repo: CompanyInvitationRepositoryInterface,
        user_repo: UserRepositoryInterface,
        role_repo: CompanyRoleRepositoryInterface | None = None,
    ):
        self._company_repo = company_repo
        self._member_repo = member_repo
        self._invitation_repo = invitation_repo
        self._user_repo = user_repo
        self._role_repo = role_repo

    async def _is_owner(self, company_id: UUID, user_id: UUID) -> bool:
        """Проверить, является ли пользователь владельцем компании."""
        member = await self._member_repo.get_by_company_and_user(company_id, user_id)
        if not member or not member.role_id:
            return False

        if not self._role_repo:
            return False

        role = await self._role_repo.get_by_id(member.role_id)
        return role is not None and role.is_owner_role()

    async def _is_admin_or_higher(self, company_id: UUID, user_id: UUID) -> bool:
        """Проверить, является ли пользователь админом или владельцем."""
        member = await self._member_repo.get_by_company_and_user(company_id, user_id)
        if not member or not member.role_id:
            return False

        if not self._role_repo:
            return False

        role = await self._role_repo.get_by_id(member.role_id)
        return role is not None and (role.is_owner_role() or role.is_admin_role())

    async def _get_member_role(self, member: CompanyMember):
        """Получить роль члена компании."""
        if not member.role_id or not self._role_repo:
            return None
        return await self._role_repo.get_by_id(member.role_id)

    async def create_company(
        self,
        owner: User,
        name: str,
        email_domain: str,
        logo_url: str | None = None,
        description: str | None = None,
        allow_auto_join: bool = False,
    ) -> Company:
        """
        Создать новую компанию.

        Args:
            owner: Пользователь-владелец
            name: Название компании
            email_domain: Домен email компании
            logo_url: URL логотипа
            description: Описание компании
            allow_auto_join: Разрешить автоматическое вступление по домену email

        Returns:
            Созданная компания

        Raises:
            CompanyAlreadyExistsError: Компания с таким доменом уже существует
        """
        # Проверяем, не занят ли домен
        existing = await self._company_repo.get_by_domain(email_domain.lower())
        if existing:
            raise CompanyAlreadyExistsError(
                f"Компания с доменом {email_domain} уже существует"
            )

        # Создаём компанию
        company = Company(
            name=name,
            email_domain=email_domain.lower(),
            logo_url=logo_url,
            description=description,
            owner_id=owner.id,
            allow_auto_join=allow_auto_join,
        )
        company = await self._company_repo.create(company)

        # Создаём системные роли для компании
        owner_role_id = None
        if self._role_repo:
            roles = await self._role_repo.create_system_roles(company.id)
            # roles[0] = Owner role
            owner_role_id = roles[0].id if roles else None

        # Добавляем владельца как члена с ролью Owner
        owner_member = CompanyMember(
            company_id=company.id,
            user_id=owner.id,
            role_id=owner_role_id,
        )
        await self._member_repo.create(owner_member)

        logger.info(f"Company {company.id} created by user {owner.id}")
        return company

    async def get_company(self, company_id: UUID) -> Company:
        """Получить компанию по ID."""
        company = await self._company_repo.get_by_id(company_id)
        if not company:
            raise CompanyNotFoundError(f"Компания {company_id} не найдена")
        return company

    async def get_user_companies(self, user_id: UUID) -> list[dict]:
        """
        Получить все компании пользователя с его ролью.

        Returns:
            Список словарей с данными компании и ролью пользователя
        """
        memberships = await self._member_repo.get_by_user(user_id)
        result = []
        for membership in memberships:
            company = await self._company_repo.get_by_id(membership.company_id)
            if company and company.is_active:
                # Получаем роль по role_id
                role = await self._get_member_role(membership)
                result.append(
                    {
                        "company": company,
                        "role": role,
                        "joined_at": membership.joined_at,
                    }
                )
        return result

    async def update_company(
        self,
        company_id: UUID,
        user_id: UUID,
        name: str | None = None,
        logo_url: str | None = None,
        description: str | None = None,
        allow_auto_join: bool | None = None,
    ) -> Company:
        """
        Обновить данные компании.

        Args:
            company_id: ID компании
            user_id: ID пользователя, выполняющего обновление
            name: Новое название
            logo_url: Новый URL логотипа
            description: Новое описание
            allow_auto_join: Разрешить автоматическое вступление

        Returns:
            Обновлённая компания

        Raises:
            CompanyNotFoundError: Компания не найдена
            PermissionDeniedError: Недостаточно прав
        """
        company = await self.get_company(company_id)

        # Проверяем права через role_repo или напрямую через компанию
        is_admin = await self._is_admin_or_higher(company_id, user_id)
        if not is_admin:
            raise PermissionDeniedError(
                "Только владелец или администратор может редактировать компанию"
            )

        if name is not None:
            company.update_name(name)
        if logo_url is not None:
            company.update_logo(logo_url)
        if description is not None:
            company.description = description
            company.updated_at = datetime.now(timezone.utc)
        if allow_auto_join is not None:
            company.allow_auto_join = allow_auto_join
            company.updated_at = datetime.now(timezone.utc)

        return await self._company_repo.update(company)

    async def delete_company(self, company_id: UUID, user_id: UUID) -> bool:
        """
        Удалить компанию.

        Args:
            company_id: ID компании
            user_id: ID пользователя

        Returns:
            True если удалено

        Raises:
            CompanyNotFoundError: Компания не найдена
            PermissionDeniedError: Только владелец может удалить компанию
        """
        company = await self.get_company(company_id)

        is_owner = await self._is_owner(company_id, user_id)
        if not is_owner:
            raise PermissionDeniedError("Только владелец может удалить компанию")

        # Удаляем все приглашения
        await self._invitation_repo.delete_by_company(company_id)
        # Удаляем все роли компании
        if self._role_repo:
            await self._role_repo.delete_by_company(company_id)
        # Удаляем всех членов
        await self._member_repo.delete_by_company(company_id)
        # Удаляем компанию
        result = await self._company_repo.delete(company_id)

        logger.info(f"Company {company_id} deleted by user {user_id}")
        return result

    # ==================== Управление членами ====================

    async def get_members(
        self,
        company_id: UUID,
        user_id: UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> list[dict]:
        """
        Получить членов компании с информацией о пользователях.

        Returns:
            Список словарей с данными членов
        """
        # Проверяем, что пользователь является членом
        member = await self._member_repo.get_by_company_and_user(company_id, user_id)
        if not member:
            raise PermissionDeniedError("Вы не являетесь членом этой компании")

        memberships = await self._member_repo.get_by_company(company_id, skip, limit)
        result = []
        for m in memberships:
            user = await self._user_repo.get_by_id(m.user_id)
            if user:
                # Получаем роль по role_id
                role = None
                if m.role_id and self._role_repo:
                    role = await self._role_repo.get_by_id(m.role_id)
                result.append(
                    {
                        "id": m.id,
                        "user": user,
                        "role": role,
                        "position": m.position,
                        "department": m.department,
                        "selected_card_id": m.selected_card_id,
                        "joined_at": m.joined_at,
                    }
                )
        return result

    async def update_member_role(
        self,
        company_id: UUID,
        member_user_id: UUID,
        new_role_id: UUID,
        admin_user_id: UUID,
    ) -> CompanyMember:
        """
        Изменить роль члена компании.

        DEPRECATED: Используйте CompanyRoleService.assign_role_to_member()

        Args:
            company_id: ID компании
            member_user_id: ID пользователя, роль которого меняем
            new_role_id: ID новой роли
            admin_user_id: ID пользователя, выполняющего изменение

        Returns:
            Обновлённое членство

        Raises:
            PermissionDeniedError: Недостаточно прав
            MemberNotFoundError: Член не найден
            CannotChangeOwnRoleError: Нельзя изменить свою роль
        """
        is_owner = await self._is_owner(company_id, admin_user_id)
        if not is_owner:
            raise PermissionDeniedError("Только владелец может изменять роли")

        if member_user_id == admin_user_id:
            raise CannotChangeOwnRoleError("Нельзя изменить свою роль")

        target_member = await self._member_repo.get_by_company_and_user(
            company_id, member_user_id
        )
        if not target_member:
            raise MemberNotFoundError("Пользователь не является членом компании")

        # Проверяем, что новая роль не является ролью владельца
        if self._role_repo:
            new_role = await self._role_repo.get_by_id(new_role_id)
            if new_role and new_role.is_owner_role():
                raise PermissionDeniedError("Нельзя назначить нового владельца")

        target_member.set_role(new_role_id)
        return await self._member_repo.update(target_member)

    async def remove_member(
        self,
        company_id: UUID,
        member_user_id: UUID,
        admin_user_id: UUID,
    ) -> bool:
        """
        Удалить члена из компании.

        Args:
            company_id: ID компании
            member_user_id: ID удаляемого пользователя
            admin_user_id: ID пользователя, выполняющего удаление

        Returns:
            True если удалено

        Raises:
            PermissionDeniedError: Недостаточно прав
            MemberNotFoundError: Член не найден
            CannotRemoveOwnerError: Нельзя удалить владельца
        """
        is_admin = await self._is_admin_or_higher(company_id, admin_user_id)
        if not is_admin:
            raise PermissionDeniedError(
                "Только владелец или администратор может удалять членов"
            )

        target_member = await self._member_repo.get_by_company_and_user(
            company_id, member_user_id
        )
        if not target_member:
            raise MemberNotFoundError("Пользователь не является членом компании")

        # Проверяем роль удаляемого
        target_role = await self._get_member_role(target_member)
        if target_role and target_role.is_owner_role():
            raise CannotRemoveOwnerError("Нельзя удалить владельца компании")

        # Проверяем иерархию - админ не может удалить другого админа
        admin_member = await self._member_repo.get_by_company_and_user(
            company_id, admin_user_id
        )
        admin_role = await self._get_member_role(admin_member) if admin_member else None

        if admin_role and target_role:
            # Если удаляющий не выше в иерархии
            if (
                not admin_role.is_higher_than(target_role)
                and not admin_role.is_owner_role()
            ):
                raise PermissionDeniedError(
                    "Вы не можете удалить члена с ролью выше или равной вашей"
                )

        result = await self._member_repo.delete(target_member.id)
        logger.info(
            f"Member {member_user_id} removed from company {company_id} by {admin_user_id}"
        )
        return result

    async def leave_company(self, company_id: UUID, user_id: UUID) -> bool:
        """
        Покинуть компанию (самостоятельно).

        Args:
            company_id: ID компании
            user_id: ID пользователя

        Returns:
            True если успешно

        Raises:
            MemberNotFoundError: Не является членом
            CannotRemoveOwnerError: Владелец не может покинуть компанию
        """
        member = await self._member_repo.get_by_company_and_user(company_id, user_id)
        if not member:
            raise MemberNotFoundError("Вы не являетесь членом этой компании")

        role = await self._get_member_role(member)
        if role and role.is_owner_role():
            raise CannotRemoveOwnerError(
                "Владелец не может покинуть компанию. Сначала передайте права или удалите компанию."
            )

        result = await self._member_repo.delete(member.id)
        logger.info(f"User {user_id} left company {company_id}")
        return result

    async def set_selected_card(
        self,
        company_id: UUID,
        user_id: UUID,
        card_id: UUID | None,
    ) -> dict:
        """
        Установить выбранную визитку для отображения в компании.

        Args:
            company_id: ID компании
            user_id: ID пользователя
            card_id: ID визитки (или None для сброса)

        Returns:
            Словарь с информацией о компании и выбранной визитке

        Raises:
            MemberNotFoundError: Не является членом компании
        """
        member = await self._member_repo.get_by_company_and_user(company_id, user_id)
        if not member:
            raise MemberNotFoundError("Вы не являетесь членом этой компании")

        member.set_selected_card(card_id)
        await self._member_repo.update(member)

        company = await self._company_repo.get_by_id(company_id)

        logger.info(
            f"User {user_id} set selected card {card_id} for company {company_id}"
        )

        return {
            "company_id": company_id,
            "company_name": company.name if company else "",
            "selected_card_id": card_id,
        }

    async def get_user_card_assignments(self, user_id: UUID) -> list[dict]:
        """
        Получить информацию о выбранных визитках пользователя для всех компаний.

        Args:
            user_id: ID пользователя

        Returns:
            Список словарей с информацией о компаниях и выбранных визитках
        """
        memberships = await self._member_repo.get_by_user(user_id)
        result = []

        for member in memberships:
            company = await self._company_repo.get_by_id(member.company_id)
            if company:
                result.append(
                    {
                        "company_id": company.id,
                        "company_name": company.name,
                        "selected_card_id": member.selected_card_id,
                    }
                )

        return result

    # ==================== Приглашения ====================

    async def create_invitation(
        self,
        company_id: UUID,
        email: str,
        role: CompanyRole,
        invited_by_id: UUID,
    ) -> CompanyInvitation:
        """
        Создать приглашение в компанию.

        Args:
            company_id: ID компании
            email: Email приглашаемого
            role: Предлагаемая роль
            invited_by_id: ID приглашающего

        Returns:
            Созданное приглашение

        Raises:
            CompanyNotFoundError: Компания не найдена
            PermissionDeniedError: Недостаточно прав
            AlreadyMemberError: Пользователь уже член компании
            InvitationAlreadyExistsError: Приглашение уже отправлено
        """
        company = await self.get_company(company_id)

        # Проверяем права приглашающего
        inviter = await self._member_repo.get_by_company_and_user(
            company_id, invited_by_id
        )
        if not inviter or not inviter.can_invite():
            raise PermissionDeniedError(
                "Только владелец или администратор может приглашать"
            )

        # Проверяем, не является ли уже членом
        existing_user = await self._user_repo.get_by_email(email.lower())
        if existing_user:
            existing_member = await self._member_repo.get_by_company_and_user(
                company_id, existing_user.id
            )
            if existing_member:
                raise AlreadyMemberError("Пользователь уже является членом компании")

        # Проверяем существующее приглашение
        existing_invitation = (
            await self._invitation_repo.get_pending_by_email_and_company(
                email, company_id
            )
        )
        if existing_invitation:
            raise InvitationAlreadyExistsError(
                "Приглашение для этого email уже отправлено"
            )

        # Генерируем токен
        token = secrets.token_urlsafe(INVITATION_TOKEN_LENGTH)
        expires_at = datetime.now(timezone.utc) + timedelta(days=INVITATION_EXPIRE_DAYS)

        invitation = CompanyInvitation(
            company_id=company_id,
            email=email.lower(),
            role=role,
            invited_by_id=invited_by_id,
            token=token,
            expires_at=expires_at,
        )
        invitation = await self._invitation_repo.create(invitation)

        logger.info(f"Invitation created for {email} to company {company_id}")
        return invitation

    async def get_pending_invitations_for_user(self, email: str) -> list[dict]:
        """
        Получить ожидающие приглашения для пользователя.

        Returns:
            Список словарей с данными приглашений
        """
        invitations = await self._invitation_repo.get_by_email(
            email, InvitationStatus.PENDING
        )
        result = []
        for inv in invitations:
            if not inv.is_expired():
                company = await self._company_repo.get_by_id(inv.company_id)
                if company:
                    inviter = (
                        await self._user_repo.get_by_id(inv.invited_by_id)
                        if inv.invited_by_id
                        else None
                    )
                    result.append(
                        {
                            "invitation": inv,
                            "company": company,
                            "invited_by": inviter,
                        }
                    )
        return result

    async def get_company_invitations(
        self,
        company_id: UUID,
        user_id: UUID,
        status: InvitationStatus | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[CompanyInvitation]:
        """
        Получить приглашения компании.

        Returns:
            Список приглашений
        """
        member = await self._member_repo.get_by_company_and_user(company_id, user_id)
        if not member or not member.can_manage_members():
            raise PermissionDeniedError(
                "Только владелец или администратор может просматривать приглашения"
            )

        return await self._invitation_repo.get_by_company(
            company_id, status, skip, limit
        )

    async def accept_invitation(self, token: str, user: User) -> CompanyMember:
        """
        Принять приглашение.

        Args:
            token: Токен приглашения
            user: Пользователь, принимающий приглашение

        Returns:
            Созданное членство

        Raises:
            InvitationNotFoundError: Приглашение не найдено
            InvitationExpiredError: Приглашение истекло
            AlreadyMemberError: Уже член компании
        """
        invitation = await self._invitation_repo.get_by_token(token)
        if not invitation:
            raise InvitationNotFoundError("Приглашение не найдено")

        if invitation.status != InvitationStatus.PENDING:
            raise InvitationNotFoundError("Приглашение уже использовано или отменено")

        if invitation.is_expired():
            invitation.status = InvitationStatus.EXPIRED
            await self._invitation_repo.update(invitation)
            raise InvitationExpiredError("Приглашение истекло")

        # Проверяем email
        if invitation.email.lower() != user.email.lower():
            raise PermissionDeniedError(
                "Это приглашение предназначено для другого email"
            )

        # Проверяем, не член ли уже
        existing = await self._member_repo.get_by_company_and_user(
            invitation.company_id, user.id
        )
        if existing:
            raise AlreadyMemberError("Вы уже являетесь членом компании")

        # Принимаем приглашение
        invitation.accept()
        await self._invitation_repo.update(invitation)

        # Создаём членство
        member = CompanyMember(
            company_id=invitation.company_id,
            user_id=user.id,
            role=invitation.role,
        )
        member = await self._member_repo.create(member)

        logger.info(
            f"User {user.id} accepted invitation to company {invitation.company_id}"
        )
        return member

    async def decline_invitation(self, token: str, user: User) -> bool:
        """
        Отклонить приглашение.

        Args:
            token: Токен приглашения
            user: Пользователь

        Returns:
            True если отклонено
        """
        invitation = await self._invitation_repo.get_by_token(token)
        if not invitation:
            raise InvitationNotFoundError("Приглашение не найдено")

        if invitation.email.lower() != user.email.lower():
            raise PermissionDeniedError(
                "Это приглашение предназначено для другого email"
            )

        invitation.decline()
        await self._invitation_repo.update(invitation)

        logger.info(
            f"User {user.id} declined invitation to company {invitation.company_id}"
        )
        return True

    async def cancel_invitation(
        self,
        invitation_id: UUID,
        admin_user_id: UUID,
    ) -> bool:
        """
        Отменить приглашение (администратором).

        Args:
            invitation_id: ID приглашения
            admin_user_id: ID администратора

        Returns:
            True если отменено
        """
        invitation = await self._invitation_repo.get_by_id(invitation_id)
        if not invitation:
            raise InvitationNotFoundError("Приглашение не найдено")

        admin_member = await self._member_repo.get_by_company_and_user(
            invitation.company_id, admin_user_id
        )
        if not admin_member or not admin_member.can_manage_members():
            raise PermissionDeniedError(
                "Только владелец или администратор может отменять приглашения"
            )

        invitation.cancel()
        await self._invitation_repo.update(invitation)

        logger.info(f"Invitation {invitation_id} cancelled by {admin_user_id}")
        return True

    async def resend_invitation(
        self,
        invitation_id: UUID,
        admin_user_id: UUID,
    ) -> CompanyInvitation:
        """
        Переотправить приглашение (создать новое с новым токеном).

        Args:
            invitation_id: ID старого приглашения
            admin_user_id: ID администратора

        Returns:
            Новое приглашение
        """
        old_invitation = await self._invitation_repo.get_by_id(invitation_id)
        if not old_invitation:
            raise InvitationNotFoundError("Приглашение не найдено")

        admin_member = await self._member_repo.get_by_company_and_user(
            old_invitation.company_id, admin_user_id
        )
        if not admin_member or not admin_member.can_invite():
            raise PermissionDeniedError(
                "Только владелец или администратор может переотправлять приглашения"
            )

        # Отменяем старое
        old_invitation.cancel()
        await self._invitation_repo.update(old_invitation)

        # Создаём новое
        return await self.create_invitation(
            company_id=old_invitation.company_id,
            email=old_invitation.email,
            role=old_invitation.role,
            invited_by_id=admin_user_id,
        )

    def generate_invitation_link(self, token: str, base_url: str) -> str:
        """
        Генерирует ссылку для приглашения.

        Args:
            token: Токен приглашения
            base_url: Базовый URL приложения

        Returns:
            Полная ссылка для приглашения
        """
        return f"{base_url}/invite/{token}"
