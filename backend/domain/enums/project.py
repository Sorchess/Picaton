"""Enums для проектов и чата."""

from enum import Enum


class ProjectStatus(str, Enum):
    """Статус проекта."""

    FORMING = "forming"  # Формирование команды
    ACTIVE = "active"  # Активный проект
    PAUSED = "paused"  # На паузе
    COMPLETED = "completed"  # Завершён
    ARCHIVED = "archived"  # В архиве


class ProjectMemberRole(str, Enum):
    """Роль участника в проекте."""

    OWNER = "owner"  # Владелец (автор идеи)
    ADMIN = "admin"  # Администратор
    MEMBER = "member"  # Участник
    PENDING = "pending"  # Ожидает подтверждения (подал заявку)
    INVITED = "invited"  # Приглашён, ожидает ответа


class MessageType(str, Enum):
    """Тип сообщения в чате."""

    TEXT = "text"  # Текстовое сообщение
    SYSTEM = "system"  # Системное сообщение (вступил, вышел и т.д.)
    FILE = "file"  # Файл
    IMAGE = "image"  # Изображение
