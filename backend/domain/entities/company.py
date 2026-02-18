"""Доменные сущности для корпоративного пространства."""

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID

from domain.entities.base import Entity
from domain.enums.company import InvitationStatus


# Валидация
COMPANY_NAME_REGEX = re.compile(r"^[\w\s\-'.,&()]{2,100}$", re.UNICODE)
DOMAIN_REGEX = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$")
URL_REGEX = re.compile(r"^https?://[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+$")

MAX_COMPANY_NAME_LENGTH = 100
MAX_DOMAIN_LENGTH = 255
MAX_LOGO_URL_LENGTH = 500
MAX_DESCRIPTION_LENGTH = 1000


class InvalidCompanyNameError(ValueError):
    """Невалидное название компании."""

    pass


class InvalidDomainError(ValueError):
    """Невалидный домен email."""

    pass


class InvalidLogoUrlError(ValueError):
    """Невалидный URL логотипа."""

    pass


@dataclass
class Company(Entity):
    """
    Доменная сущность компании.
    Представляет корпоративное пространство для команды.
    """

    # Основные данные
    name: str = field(default="")
    email_domain: str = field(default="")  # Домен для автоматического присоединения
    logo_url: str | None = field(default=None)
    description: str | None = field(default=None)

    # Владелец компании
    owner_id: UUID | None = field(default=None)

    # Настройки
    is_active: bool = field(default=True)

    # Timestamps
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self) -> None:
        """Валидация данных при создании сущности."""
        if self.name:
            self._validate_name(self.name)
        if self.email_domain:
            self._validate_domain(self.email_domain)
        if self.logo_url:
            self._validate_logo_url(self.logo_url)

    @staticmethod
    def _validate_name(name: str) -> None:
        """Валидация названия компании."""
        if len(name) > MAX_COMPANY_NAME_LENGTH:
            raise InvalidCompanyNameError(
                f"Название компании не должно превышать {MAX_COMPANY_NAME_LENGTH} символов"
            )
        if not COMPANY_NAME_REGEX.match(name):
            raise InvalidCompanyNameError(
                "Название компании содержит недопустимые символы"
            )

    @staticmethod
    def _validate_domain(domain: str) -> None:
        """Валидация домена email."""
        if len(domain) > MAX_DOMAIN_LENGTH:
            raise InvalidDomainError(
                f"Домен не должен превышать {MAX_DOMAIN_LENGTH} символов"
            )
        if not DOMAIN_REGEX.match(domain):
            raise InvalidDomainError("Невалидный формат домена")

    @staticmethod
    def _validate_logo_url(url: str) -> None:
        """Валидация URL логотипа."""
        if len(url) > MAX_LOGO_URL_LENGTH:
            raise InvalidLogoUrlError(
                f"URL логотипа не должен превышать {MAX_LOGO_URL_LENGTH} символов"
            )
        if not URL_REGEX.match(url):
            raise InvalidLogoUrlError("Невалидный URL логотипа")

    def update_name(self, name: str) -> None:
        """Обновить название компании."""
        self._validate_name(name)
        self.name = name
        self.updated_at = datetime.now(timezone.utc)

    def update_domain(self, domain: str) -> None:
        """Обновить домен email."""
        self._validate_domain(domain)
        self.email_domain = domain
        self.updated_at = datetime.now(timezone.utc)

    def update_logo(self, logo_url: str | None) -> None:
        """Обновить логотип."""
        if logo_url:
            self._validate_logo_url(logo_url)
        self.logo_url = logo_url
        self.updated_at = datetime.now(timezone.utc)


# Валидация для CompanyMember
MAX_POSITION_LENGTH = 100
MAX_DEPARTMENT_LENGTH = 100


class InvalidPositionError(ValueError):
    """Невалидная должность."""

    pass


class InvalidDepartmentError(ValueError):
    """Невалидный отдел."""

    pass


@dataclass
class CompanyMember(Entity):
    """
    Членство пользователя в компании.
    Связывает пользователя с компанией и определяет его роль.

    Теперь использует role_id для связи с сущностью CompanyRole,
    что позволяет создавать кастомные роли с гибкими правами.
    """

    company_id: UUID = field(default=None)
    user_id: UUID = field(default=None)

    # Ссылка на роль (CompanyRole entity)
    role_id: UUID | None = field(default=None)

    # Организационная структура
    position: str | None = field(default=None)  # Должность (напр. "Senior Developer")
    department: str | None = field(default=None)  # Отдел (напр. "Engineering")

    # Выбранная визитка для отображения в этой компании
    selected_card_id: UUID | None = field(default=None)

    # Timestamps
    joined_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self) -> None:
        """Валидация данных при создании сущности."""
        if self.position:
            self._validate_position(self.position)
        if self.department:
            self._validate_department(self.department)

    @staticmethod
    def _validate_position(position: str) -> None:
        """Валидация должности."""
        if len(position) > MAX_POSITION_LENGTH:
            raise InvalidPositionError(
                f"Должность не должна превышать {MAX_POSITION_LENGTH} символов"
            )

    @staticmethod
    def _validate_department(department: str) -> None:
        """Валидация отдела."""
        if len(department) > MAX_DEPARTMENT_LENGTH:
            raise InvalidDepartmentError(
                f"Отдел не должен превышать {MAX_DEPARTMENT_LENGTH} символов"
            )

    def set_role(self, role_id: UUID) -> None:
        """Установить роль."""
        self.role_id = role_id
        self.updated_at = datetime.now(timezone.utc)

    def set_position(self, position: str | None) -> None:
        """Установить должность."""
        if position:
            self._validate_position(position)
        self.position = position
        self.updated_at = datetime.now(timezone.utc)

    def set_department(self, department: str | None) -> None:
        """Установить отдел."""
        if department:
            self._validate_department(department)
        self.department = department
        self.updated_at = datetime.now(timezone.utc)

    def set_selected_card(self, card_id: UUID | None) -> None:
        """Установить выбранную визитку для компании."""
        self.selected_card_id = card_id
        self.updated_at = datetime.now(timezone.utc)


@dataclass
class CompanyInvitation(Entity):
    """
    Приглашение в компанию.
    Отправляется пользователю для присоединения к корпоративному пространству.
    """

    company_id: UUID = field(default=None)
    email: str = field(default="")  # Email приглашаемого
    role_id: UUID | None = field(default=None)  # ID роли для приглашаемого

    # Кто отправил приглашение
    invited_by_id: UUID = field(default=None)

    # Статус
    status: InvitationStatus = field(default=InvitationStatus.PENDING)

    # Токен для верификации (уникальный для каждого приглашения)
    token: str = field(default="")

    # Timestamps
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = field(default=None)  # Срок действия приглашения
    responded_at: datetime | None = field(default=None)  # Когда ответили

    def is_expired(self) -> bool:
        """Проверить, истекло ли приглашение."""
        if self.expires_at is None:
            return False
        # Приводим expires_at к aware datetime если он naive
        expires_at = self.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) > expires_at

    def is_pending(self) -> bool:
        """Проверить, ожидает ли ответа."""
        return self.status == InvitationStatus.PENDING and not self.is_expired()

    def accept(self) -> None:
        """Принять приглашение."""
        if self.is_expired():
            self.status = InvitationStatus.EXPIRED
            raise ValueError("Приглашение истекло")
        self.status = InvitationStatus.ACCEPTED
        self.responded_at = datetime.now(timezone.utc)

    def decline(self) -> None:
        """Отклонить приглашение."""
        self.status = InvitationStatus.DECLINED
        self.responded_at = datetime.now(timezone.utc)

    def cancel(self) -> None:
        """Отменить приглашение (админом/владельцем)."""
        self.status = InvitationStatus.CANCELLED
        self.responded_at = datetime.now(timezone.utc)
