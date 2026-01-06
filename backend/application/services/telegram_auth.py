"""
Telegram Authentication Service.

Реализует авторизацию через Telegram Login Widget и Deep Link.
https://core.telegram.org/widgets/login
"""

import hashlib
import hmac
import logging
import secrets
import time
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from domain.entities.user import User
from domain.repositories.user import UserRepositoryInterface
from application.services.user import UserService
from infrastructure.storage import CloudinaryService
from settings.config import settings

logger = logging.getLogger(__name__)


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


class TelegramAuthPendingError(TelegramAuthError):
    """Авторизация ещё не подтверждена."""

    pass


class TelegramAuthTokenNotFoundError(TelegramAuthError):
    """Токен авторизации не найден или истёк."""

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


@dataclass
class PendingTelegramAuth:
    """Pending авторизация через Telegram deep link."""

    token: str
    created_at: float
    telegram_data: TelegramAuthData | None = None
    confirmed: bool = False


@dataclass
class PendingContactSync:
    """Pending сессия синхронизации контактов."""

    token: str
    created_at: float
    user_id: str  # ID пользователя который запросил синхронизацию
    contacts: list[TelegramContact] | None = None
    completed: bool = False


# In-memory storage для pending авторизаций (в продакшене использовать Redis)
_pending_auth_sessions: dict[str, PendingTelegramAuth] = {}
_pending_sync_sessions: dict[str, PendingContactSync] = {}


class TelegramAuthService:
    """
    Сервис авторизации через Telegram.

    Поддерживает два режима:
    1. Telegram Login Widget (popup окно)
    2. Deep Link авторизация (открывает приложение Telegram)
    """

    # Время жизни pending токена (5 минут)
    PENDING_TOKEN_TTL = 300

    def __init__(
        self,
        user_repository: UserRepositoryInterface,
        user_service: UserService,
        jwt_secret: str,
        jwt_algorithm: str = "HS256",
        access_token_expire_minutes: int = 10080,  # 7 days
        cloudinary_service: CloudinaryService | None = None,
    ):
        self._user_repo = user_repository
        self._user_service = user_service
        self._jwt_secret = jwt_secret
        self._jwt_algorithm = jwt_algorithm
        self._token_expire_minutes = access_token_expire_minutes
        self._cloudinary = cloudinary_service

    # ==================== Deep Link Auth ====================

    def create_auth_token(self) -> dict:
        """
        Создать токен для deep link авторизации.

        Returns:
            dict с token и deep_link URL
        """
        bot_username = settings.telegram.bot_username
        if not bot_username:
            raise TelegramBotNotConfiguredError(
                "Telegram бот не настроен. Укажите TELEGRAM__BOT_USERNAME в .env"
            )

        # Генерируем уникальный токен
        token = secrets.token_urlsafe(32)

        # Сохраняем pending сессию
        _pending_auth_sessions[token] = PendingTelegramAuth(
            token=token,
            created_at=time.time(),
        )

        # Очищаем старые сессии
        self._cleanup_expired_sessions()

        # Формируем deep link
        # tg://resolve открывает приложение, https://t.me работает как fallback
        deep_link = f"https://t.me/{bot_username}?start=auth_{token}"
        tg_link = f"tg://resolve?domain={bot_username}&start=auth_{token}"

        return {
            "token": token,
            "deep_link": deep_link,
            "tg_link": tg_link,
            "expires_in": self.PENDING_TOKEN_TTL,
        }

    def confirm_auth_from_bot(
        self,
        token: str,
        telegram_id: int,
        first_name: str,
        last_name: str | None = None,
        username: str | None = None,
        photo_url: str | None = None,
    ) -> bool:
        """
        Подтвердить авторизацию от Telegram бота.

        Вызывается когда бот получает /start auth_TOKEN от пользователя.

        Args:
            token: Токен авторизации (без префикса auth_)
            telegram_id: ID пользователя в Telegram
            first_name: Имя пользователя
            last_name: Фамилия
            username: Username в Telegram
            photo_url: URL аватара

        Returns:
            True если токен валиден и авторизация подтверждена
        """
        # Убираем префикс auth_ если он есть
        if token.startswith("auth_"):
            token = token[5:]

        pending = _pending_auth_sessions.get(token)
        if not pending:
            return False

        # Проверяем TTL
        if time.time() - pending.created_at > self.PENDING_TOKEN_TTL:
            del _pending_auth_sessions[token]
            return False

        # Сохраняем данные пользователя
        pending.telegram_data = TelegramAuthData(
            id=telegram_id,
            first_name=first_name,
            last_name=last_name,
            username=username,
            photo_url=photo_url,
            auth_date=int(time.time()),
        )
        pending.confirmed = True

        return True

    async def check_auth_status(self, token: str) -> dict:
        """
        Проверить статус авторизации по токену.

        Фронтенд polling'ом вызывает этот метод.

        Returns:
            dict со статусом и данными пользователя если авторизован
        """
        pending = _pending_auth_sessions.get(token)

        if not pending:
            return {"status": "expired", "message": "Токен не найден или истёк"}

        # Проверяем TTL
        if time.time() - pending.created_at > self.PENDING_TOKEN_TTL:
            del _pending_auth_sessions[token]
            return {"status": "expired", "message": "Токен истёк"}

        if not pending.confirmed or not pending.telegram_data:
            remaining = int(self.PENDING_TOKEN_TTL - (time.time() - pending.created_at))
            return {"status": "pending", "remaining": remaining}

        # Авторизация подтверждена - создаём/обновляем пользователя
        tg_data = pending.telegram_data

        # Ищем или создаём пользователя
        user = await self._user_repo.find_by_telegram_id(tg_data.id)

        if user:
            user = await self._update_user_from_telegram(user, tg_data)
        else:
            user = await self._create_user_from_telegram(tg_data)

        # Генерируем JWT токен
        access_token = self._create_access_token(user.id)

        # Удаляем использованную сессию
        del _pending_auth_sessions[token]

        return {
            "status": "confirmed",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "avatar_url": user.avatar_url,
                "telegram_id": user.telegram_id,
                "telegram_username": user.telegram_username,
            },
            "access_token": access_token,
        }

    def _cleanup_expired_sessions(self) -> None:
        """Удалить истёкшие pending сессии."""
        current_time = time.time()
        expired = [
            token
            for token, session in _pending_auth_sessions.items()
            if current_time - session.created_at > self.PENDING_TOKEN_TTL
        ]
        for token in expired:
            del _pending_auth_sessions[token]

    # ==================== Widget Auth (existing) ====================

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

        # Сначала создаём пользователя без аватара
        user = User(
            first_name=tg_data.first_name,
            last_name=tg_data.last_name or "",
            email=placeholder_email,
            telegram_id=tg_data.id,
            telegram_username=tg_data.username,
            avatar_url=None,
        )

        user = await self._user_repo.create(user)

        # Загружаем аватар в Cloudinary для постоянного хранения
        if tg_data.photo_url and self._cloudinary:
            try:
                result = await self._cloudinary.upload_avatar_from_url(
                    user.id, tg_data.photo_url
                )
                if result:
                    user.avatar_url = result.url
                    user = await self._user_repo.update(user)
                    logger.info(
                        f"Avatar persisted to Cloudinary for new user {user.id}"
                    )
            except Exception as e:
                logger.error(f"Failed to persist avatar for user {user.id}: {e}")
                # Fallback to temporary Telegram URL
                user.avatar_url = tg_data.photo_url
                user = await self._user_repo.update(user)

        return user

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
        # или если текущий аватар - временная ссылка Telegram
        if tg_data.photo_url and (
            not user.avatar_url or "api.telegram.org" in (user.avatar_url or "")
        ):
            # Загружаем в Cloudinary для постоянного хранения
            if self._cloudinary:
                try:
                    result = await self._cloudinary.upload_avatar_from_url(
                        user.id, tg_data.photo_url
                    )
                    if result:
                        user.avatar_url = result.url
                        updated = True
                        logger.info(f"Avatar updated in Cloudinary for user {user.id}")
                except Exception as e:
                    logger.error(f"Failed to update avatar for user {user.id}: {e}")
            else:
                # Fallback if Cloudinary not configured
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

    # ==================== Contact Sync via Bot ====================

    def create_sync_session(self, user_id: str) -> dict:
        """
        Создать сессию синхронизации контактов.

        Пользователь переходит в бота, пересылает контакты,
        бот отправляет их на сервер.

        Args:
            user_id: ID авторизованного пользователя

        Returns:
            dict с token и deep_link URL
        """
        bot_username = settings.telegram.bot_username
        if not bot_username:
            raise TelegramBotNotConfiguredError(
                "Telegram бот не настроен. Укажите TELEGRAM__BOT_USERNAME в .env"
            )

        # Генерируем уникальный токен
        token = secrets.token_urlsafe(32)

        # Сохраняем pending сессию
        _pending_sync_sessions[token] = PendingContactSync(
            token=token,
            created_at=time.time(),
            user_id=user_id,
        )

        # Очищаем старые сессии
        self._cleanup_expired_sync_sessions()

        # Формируем deep link
        deep_link = f"https://t.me/{bot_username}?start=sync_{token}"
        tg_link = f"tg://resolve?domain={bot_username}&start=sync_{token}"

        return {
            "token": token,
            "deep_link": deep_link,
            "tg_link": tg_link,
            "expires_in": self.PENDING_TOKEN_TTL,
        }

    def add_contacts_to_sync(
        self,
        token: str,
        contacts: list[TelegramContact],
    ) -> bool:
        """
        Добавить контакты в сессию синхронизации (вызывается ботом).

        Args:
            token: Токен сессии (без префикса sync_)
            contacts: Список контактов

        Returns:
            True если успешно
        """
        if token.startswith("sync_"):
            token = token[5:]

        pending = _pending_sync_sessions.get(token)
        if not pending:
            return False

        # Проверяем TTL
        if time.time() - pending.created_at > self.PENDING_TOKEN_TTL:
            del _pending_sync_sessions[token]
            return False

        # Добавляем контакты (или заменяем)
        pending.contacts = contacts
        return True

    def complete_sync(self, token: str) -> bool:
        """
        Завершить сессию синхронизации (вызывается ботом).

        Args:
            token: Токен сессии (без префикса sync_)

        Returns:
            True если успешно
        """
        if token.startswith("sync_"):
            token = token[5:]

        pending = _pending_sync_sessions.get(token)
        if not pending:
            return False

        # Проверяем TTL
        if time.time() - pending.created_at > self.PENDING_TOKEN_TTL:
            del _pending_sync_sessions[token]
            return False

        pending.completed = True
        return True

    async def check_sync_status(self, token: str) -> dict[str, Any]:
        """
        Проверить статус синхронизации контактов.

        Args:
            token: Токен сессии

        Returns:
            dict со статусом и результатами
        """
        pending = _pending_sync_sessions.get(token)

        if not pending:
            return {
                "status": "expired",
                "message": "Сессия синхронизации не найдена или истекла",
            }

        elapsed = time.time() - pending.created_at
        remaining = max(0, int(self.PENDING_TOKEN_TTL - elapsed))

        if elapsed > self.PENDING_TOKEN_TTL:
            del _pending_sync_sessions[token]
            return {
                "status": "expired",
                "message": "Время синхронизации истекло",
            }

        if not pending.completed:
            return {
                "status": "pending",
                "message": "Ожидаем контакты из Telegram",
                "remaining": remaining,
            }

        # Синхронизация завершена - ищем контакты в базе
        contacts = pending.contacts or []

        if not contacts:
            # Удаляем сессию
            del _pending_sync_sessions[token]
            return {
                "status": "completed",
                "message": "Контакты не получены",
                "contacts": [],
            }

        # Ищем пользователей
        from uuid import UUID

        user_id = UUID(pending.user_id)
        result = await self.sync_contacts(user_id, contacts)

        # Удаляем сессию
        del _pending_sync_sessions[token]

        return {
            "status": "completed",
            "message": f"Найдено {result['found_count']} контактов",
            "contacts": result["found"],
        }

    def _cleanup_expired_sync_sessions(self) -> None:
        """Удалить истёкшие сессии синхронизации."""
        now = time.time()
        expired = [
            token
            for token, session in _pending_sync_sessions.items()
            if now - session.created_at > self.PENDING_TOKEN_TTL
        ]
        for token in expired:
            del _pending_sync_sessions[token]
