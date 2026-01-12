"""Enums для идей и свайпов (Фабрика Идей)."""

from enum import Enum


class IdeaStatus(str, Enum):
    """Статус идеи в workflow Фабрики Идей."""

    DRAFT = "draft"  # Черновик
    IN_REVIEW = "in_review"  # На модерации (для компаний)
    ACTIVE = "active"  # Активная, доступна для свайпов
    TEAM_FORMING = "team_forming"  # Формируется команда
    TEAM_FORMED = "team_formed"  # Команда сформирована
    IN_PROGRESS = "in_progress"  # Проект в работе
    COMPLETED = "completed"  # Проект завершён
    ARCHIVED = "archived"  # В архиве


class IdeaVisibility(str, Enum):
    """Видимость идеи."""

    PUBLIC = "public"  # Видна всем (для личных аккаунтов)
    COMPANY = "company"  # Видна только внутри компании (tenant)
    DEPARTMENT = "department"  # Видна только в департаменте
    PRIVATE = "private"  # Видна только автору


class SwipeDirection(str, Enum):
    """Направление свайпа."""

    LIKE = "like"  # Нравится
    DISLIKE = "dislike"  # Не нравится
    SUPER_LIKE = "super_like"  # Очень нравится (хочу участвовать)
