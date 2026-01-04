"""
Telegram Authentication Service.

Реализует авторизацию через Telegram Login Widget.
https://core.telegram.org/widgets/login
"""

import hashlib
import hmac
import time
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from domain.entities.user import User
from domain.repositories.user import UserRepositoryInterface
from application.services.user import UserService
from settings.config import settings


class TelegramAuthError(Exception):
    """Базовая ошибка Telegram авторизации."""

    pass


class TelegramDataExpiredError(TelegramAuthError):
    """Данные авторизации истекли."""

    pass


class TelegramInvalidHashError(TelegramAuthError):
    """Невалидная подпись данных."""

    pass


class TelegramBotNotConfiguredError(TelegramAuthError):
    """Telegram бот не настроен."""

    pass


@dataclass
class TelegramAuthData:
    """Данные авторизации от Telegram."""

    id: int  # Telegram user ID
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int = 0  # Unix timestamp
    hash: str = ""  # Подпись от Telegram


@dataclass
class TelegramContact:
    """Контакт из Telegram для синхронизации."""

    telegram_id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    phone: str | None = None


class TelegramAuthService:
    """
    Сервис авторизации через Telegram.

    Верифицирует данные от Telegram Login Widget,
    создаёт/обновляет пользователя и возвращает JWT токен.
    """

    def __init__(
        self,
        user_repository: UserRepositoryInterface,
        user_service: UserService,
        jwt_secret: str,
        jwt_algorithm: str = "HS256",
        access_token_expire_minutes: int = 10080,  # 7 days
    ):
        self._user_repo = user_repository
        self._user_service = user_service
        self._jwt_secret = jwt_secret
        self._jwt_algorithm = jwt_algorithm
        self._token_expire_minutes = access_token_expire_minutes

    def verify_telegram_auth(self, auth_data: dict[str, Any]) -> TelegramAuthData:
        """
        Верифицировать данные от Telegram Login Widget.

        Telegram подписывает данные хешем от bot_token.
        Мы проверяем подпись, чтобы убедиться, что данные от Telegram.

        Args:
            auth_data: Словарь с данными от Telegram widget

        Returns:
            TelegramAuthData с верифицированными данными

        Raises:
            TelegramBotNotConfiguredError: Бот не настроен
            TelegramDataExpiredError: Данные устарели
            TelegramInvalidHashError: Невалидная подпись
        """
        bot_token = settings.telegram.bot_token
        if not bot_token:
            raise TelegramBotNotConfiguredError(
                "Telegram бот не настроен. Укажите TELEGRAM__BOT_TOKEN в .env"
            )

        # Проверяем, что данные не устарели
        auth_date = int(auth_data.get("auth_date", 0))
        current_time = int(time.time())

        if current_time - auth_date > settings.telegram.auth_timeout:
            raise TelegramDataExpiredError("Данные авторизации Telegram устарели")

        # Проверяем подпись
        received_hash = auth_data.get("hash", "")
        if not self._verify_hash(auth_data, bot_token, received_hash):
            raise TelegramInvalidHashError("Невалидная подпись данных Telegram")

        return TelegramAuthData(
            id=int(auth_data["id"]),
            first_name=auth_data.get("first_name", ""),
            last_name=auth_data.get("last_name"),
            username=auth_data.get("username"),
            photo_url=auth_data.get("photo_url"),
            auth_date=auth_date,
            hash=received_hash,
        )

    def _verify_hash(
        self, auth_data: dict[str, Any], bot_token: str, received_hash: str
    ) -> bool:
        """
        Проверить подпись данных от Telegram.

        Алгоритм:
        1. Собрать все поля (кроме hash) в формате key=value
        2. Отсортировать по ключу
        3. Соединить через \n
        4. Вычислить HMAC-SHA256 с ключом SHA256(bot_token)
        5. Сравнить с полученным hash
        """
        # Собираем данные для проверки
        check_data = {k: v for k, v in auth_data.items() if k != "hash" and v}
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(check_data.items()))

        # Секретный ключ = SHA256 от bot_token
        secret_key = hashlib.sha256(bot_token.encode()).digest()

        # Вычисляем HMAC-SHA256
        computed_hash = hmac.new(
            secret_key, data_check_string.encode(), hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(computed_hash, received_hash)

    async def authenticate(self, auth_data: dict[str, Any]) -> tuple[User, str]:
        """
        Аутентифицировать пользователя через Telegram.

        1. Верифицирует данные от Telegram
        2. Ищет существующего пользователя по telegram_id
        3. Если не найден - создаёт нового
        4. Возвращает пользователя и JWT токен

        Args:
            auth_data: Данные от Telegram Login Widget

        Returns:
            Tuple[User, str]: Пользователь и access_token
        """
        # Верифицируем данные
        tg_data = self.verify_telegram_auth(auth_data)

        # Ищем пользователя по telegram_id
        user = await self._user_repo.find_by_telegram_id(tg_data.id)

        if user:
            # Обновляем данные пользователя из Telegram
            user = await self._update_user_from_telegram(user, tg_data)
        else:
            # Создаём нового пользователя
            user = await self._create_user_from_telegram(tg_data)

        # Генерируем токен
        token = self._create_access_token(user.id)

        return user, token

    async def _create_user_from_telegram(self, tg_data: TelegramAuthData) -> User:
        """Создать нового пользователя из данных Telegram."""
        # Генерируем email-заглушку (Telegram не даёт email)
        # Пользователь сможет потом добавить реальный email
        placeholder_email = f"tg_{tg_data.id}@telegram.placeholder"

        user = User(
            first_name=tg_data.first_name,
            last_name=tg_data.last_name or "",
            email=placeholder_email,
            telegram_id=tg_data.id,
            telegram_username=tg_data.username,
            avatar_url=tg_data.photo_url,
        )

        return await self._user_repo.create(user)

    async def _update_user_from_telegram(
        self, user: User, tg_data: TelegramAuthData
    ) -> User:
        """Обновить данные пользователя из Telegram."""
        # Обновляем только если данные изменились
        updated = False

        if tg_data.username and user.telegram_username != tg_data.username:
            user.telegram_username = tg_data.username
            updated = True

        # Обновляем аватар, если у пользователя нет своего
        if tg_data.photo_url and not user.avatar_url:
            user.avatar_url = tg_data.photo_url
            updated = True

        if updated:
            user = await self._user_repo.update(user)

        return user

    def _create_access_token(self, user_id: UUID) -> str:
        """Создать JWT токен."""
        from datetime import datetime, timedelta, timezone
        from jose import jwt

        expire = datetime.now(timezone.utc) + timedelta(
            minutes=self._token_expire_minutes
        )

        payload = {
            "sub": str(user_id),
            "exp": expire,
            "iat": datetime.now(timezone.utc),
        }

        return jwt.encode(payload, self._jwt_secret, algorithm=self._jwt_algorithm)

    async def sync_telegram_contacts(
        self,
        user_id: UUID,
        contacts: list[TelegramContact],
    ) -> dict:
        """
        Синхронизировать контакты из Telegram.

        Ищет пользователей по telegram_id или username
        и возвращает список найденных.

        Args:
            user_id: ID текущего пользователя
            contacts: Список контактов из Telegram

        Returns:
            Результат синхронизации с найденными пользователями
        """
        if not contacts:
            return {"found": [], "found_count": 0, "total": 0}

        # Собираем все telegram_id и usernames
        telegram_ids = [c.telegram_id for c in contacts if c.telegram_id]
        usernames = [c.username for c in contacts if c.username]

        # Ищем пользователей
        found_by_id = await self._user_repo.find_by_telegram_ids(telegram_ids)
        found_by_username = await self._user_repo.find_by_telegram_usernames(usernames)

        # Объединяем результаты, исключая дубликаты
        found_users = {str(u.id): u for u in found_by_id}
        for u in found_by_username:
            found_users[str(u.id)] = u

        # Исключаем самого пользователя
        found_users.pop(str(user_id), None)

        # Формируем результат с информацией о контактах
        found_contacts = []
        for user in found_users.values():
            # Находим соответствующий контакт
            contact_name = None
            for c in contacts:
                if c.telegram_id == user.telegram_id or (
                    c.username and c.username == user.telegram_username
                ):
                    contact_name = f"{c.first_name} {c.last_name or ''}".strip()
                    break

            found_contacts.append(
                {
                    "user_id": str(user.id),
                    "user_name": f"{user.first_name} {user.last_name}".strip(),
                    "contact_name": contact_name,
                    "avatar_url": user.avatar_url,
                    "telegram_username": user.telegram_username,
                }
            )

        return {
            "found": found_contacts,
            "found_count": len(found_contacts),
            "total": len(contacts),
        }
