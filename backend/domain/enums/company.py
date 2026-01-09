"""Перечисления для компаний и членства."""

from enum import Enum


class InvitationStatus(str, Enum):
    """Статус приглашения в компанию."""

    PENDING = "pending"  # Ожидает ответа
    ACCEPTED = "accepted"  # Принято
    DECLINED = "declined"  # Отклонено
    EXPIRED = "expired"  # Истекло
    CANCELLED = "cancelled"  # Отменено владельцем/админом
