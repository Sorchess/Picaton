from datetime import datetime, timedelta, timezone
from uuid import UUID

from jose import JWTError, jwt

from domain.entities.user import User
from domain.exceptions.user import UserNotFoundError
from domain.repositories.user import UserRepositoryInterface
from domain.repositories.pending_hash import PendingHashRepositoryInterface
from application.services.user import UserService
from settings.config import settings


class AuthenticationError(Exception):
    """Ошибка аутентификации."""

    pass


class InvalidCredentialsError(AuthenticationError):
    """Неверные учетные данные."""

    pass


class InvalidTokenError(AuthenticationError):
    """Неверный или истёкший токен."""

    pass


class AuthService:
    """Сервис аутентификации."""

    def __init__(
        self,
        user_repository: UserRepositoryInterface,
        user_service: UserService,
        pending_hash_repository: PendingHashRepositoryInterface | None = None,
    ):
        self._user_repository = user_repository
        self._user_service = user_service
        self._pending_repo = pending_hash_repository

    async def register(
        self,
        email: str,
        password: str,
        first_name: str = "",
        last_name: str = "",
        phone_hash: str | None = None,
    ) -> tuple[User, str]:
        """Регистрация нового пользователя."""
        user = await self._user_service.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        # Если у пользователя есть хеш телефона, проверяем pending
        if phone_hash and self._pending_repo:
            await self._process_pending_hash(phone_hash)

        token = self._create_access_token(user.id)
        return user, token

    async def _process_pending_hash(self, phone_hash: str) -> list[UUID]:
        """
        Обработать pending хеш при регистрации/обновлении пользователя.

        Находит всех пользователей, ожидающих контакт с этим хешем,
        и удаляет pending записи.

        Returns:
            Список ID пользователей, которым нужно отправить уведомление
        """
        if not self._pending_repo:
            return []

        # Найти всех, кто ждёт этот контакт
        owners = await self._pending_repo.find_owners_by_hash(phone_hash)

        if owners:
            # Удалить все pending записи для этого хеша
            await self._pending_repo.remove_all_for_hash(phone_hash)
            # TODO: Отправить уведомления владельцам (email/push)
            # Пока просто возвращаем список для логирования

        return owners

    async def login(self, email: str, password: str) -> tuple[User, str]:
        """Аутентификация пользователя."""
        try:
            user = await self._user_service.get_user_by_email(email)
        except UserNotFoundError:
            raise InvalidCredentialsError("Неверный email или пароль")

        if not self._user_service.verify_password(password, user.hashed_password):
            raise InvalidCredentialsError("Неверный email или пароль")

        token = self._create_access_token(user.id)
        return user, token

    async def get_current_user(self, token: str) -> User:
        """Получить текущего пользователя по токену."""
        try:
            payload = jwt.decode(
                token,
                settings.jwt.secret_key,
                algorithms=[settings.jwt.algorithm],
            )
            user_id: str = payload.get("sub")
            if user_id is None:
                raise InvalidTokenError("Токен не содержит идентификатор пользователя")
        except JWTError:
            raise InvalidTokenError("Невалидный токен")

        try:
            user = await self._user_service.get_user(UUID(user_id))
        except UserNotFoundError:
            raise InvalidTokenError("Пользователь не найден")

        return user

    @staticmethod
    def _create_access_token(user_id: UUID) -> str:
        """Создать JWT токен."""
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.jwt.access_token_expire_minutes
        )
        to_encode = {
            "sub": str(user_id),
            "exp": expire,
            "iat": datetime.now(timezone.utc),
        }
        return jwt.encode(
            to_encode,
            settings.jwt.secret_key,
            algorithm=settings.jwt.algorithm,
        )
