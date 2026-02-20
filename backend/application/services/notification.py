"""Сервис уведомлений."""

from uuid import UUID

from domain.entities.notification import Notification
from domain.repositories.notification import NotificationRepositoryInterface
from domain.repositories.user import UserRepositoryInterface


class NotificationService:
    """Сервис для работы с уведомлениями."""

    def __init__(
        self,
        notification_repo: NotificationRepositoryInterface,
        user_repo: UserRepositoryInterface,
    ):
        self._notification_repo = notification_repo
        self._user_repo = user_repo

    async def notify_contact_added(
        self,
        owner_id: UUID,
        target_user_id: UUID,
    ) -> Notification | None:
        """
        Создать уведомление «Вас добавили в контакты».

        owner_id — кто добавил (актор)
        target_user_id — кого добавили (получатель уведомления)
        """
        # Не уведомляем самого себя
        if owner_id == target_user_id:
            return None

        # Проверяем, не было ли уже такого уведомления
        already = await self._notification_repo.exists(
            user_id=target_user_id,
            type="contact_added",
            actor_id=owner_id,
        )
        if already:
            return None

        # Получаем информацию об акторе
        actor = await self._user_repo.get_by_id(owner_id)
        if not actor:
            return None

        actor_name = f"{actor.first_name} {actor.last_name}".strip()

        notification = Notification(
            user_id=target_user_id,
            type="contact_added",
            title="Новый контакт",
            message=f"{actor_name} добавил(а) вас в контакты",
            actor_id=owner_id,
            actor_name=actor_name,
            actor_avatar_url=actor.avatar_url,
        )

        return await self._notification_repo.create(notification)

    async def get_notifications(
        self,
        user_id: UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> list[Notification]:
        """Получить уведомления пользователя."""
        return await self._notification_repo.get_by_user(user_id, skip, limit)

    async def get_unread_count(self, user_id: UUID) -> int:
        """Получить количество непрочитанных уведомлений."""
        return await self._notification_repo.get_unread_count(user_id)

    async def mark_as_read(self, notification_id: UUID) -> bool:
        """Отметить уведомление как прочитанное."""
        return await self._notification_repo.mark_as_read(notification_id)

    async def mark_all_as_read(self, user_id: UUID) -> int:
        """Отметить все уведомления как прочитанные."""
        return await self._notification_repo.mark_all_as_read(user_id)
