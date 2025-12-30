"""Фоновые задачи приложения."""

from .email_tasks import send_magic_link_email, send_welcome_email

__all__ = [
    "send_magic_link_email",
    "send_welcome_email",
]
