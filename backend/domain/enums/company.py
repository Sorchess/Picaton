"""Перечисления для компаний и членства."""

from enum import Enum


class CompanyRole(str, Enum):
    """Роли пользователей в компании."""

    OWNER = "owner"  # Владелец - полный доступ, может удалить компанию
    ADMIN = "admin"  # Администратор - управление членами, приглашения
    MEMBER = "member"  # Участник - просмотр и редактирование контактов


class InvitationStatus(str, Enum):
    """Статус приглашения в компанию."""

    PENDING = "pending"  # Ожидает ответа
    ACCEPTED = "accepted"  # Принято
    DECLINED = "declined"  # Отклонено
    EXPIRED = "expired"  # Истекло
    CANCELLED = "cancelled"  # Отменено владельцем/админом
