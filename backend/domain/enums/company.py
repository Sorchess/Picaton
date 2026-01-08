"""Перечисления для компаний и членства."""

from enum import Enum


# DEPRECATED: CompanyRole enum заменён на сущность CompanyRole (company_role.py)
# Оставлен для обратной совместимости при миграции
class LegacyCompanyRole(str, Enum):
    """
    DEPRECATED: Используйте domain.entities.company_role.CompanyRole.
    
    Старые роли пользователей в компании.
    Сохранено для обратной совместимости при миграции данных.
    """

    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class InvitationStatus(str, Enum):
    """Статус приглашения в компанию."""

    PENDING = "pending"  # Ожидает ответа
    ACCEPTED = "accepted"  # Принято
    DECLINED = "declined"  # Отклонено
    EXPIRED = "expired"  # Истекло
    CANCELLED = "cancelled"  # Отменено владельцем/админом
