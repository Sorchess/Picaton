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
    """Authentication error."""

    pass


class InvalidCredentialsError(AuthenticationError):
    """Invalid credentials."""

    pass


class InvalidTokenError(AuthenticationError):
    """Invalid or expired token."""

    pass


class AuthService:
    """Authentication service."""

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
        user = await self._user_service.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        if phone_hash and self._pending_repo:
            await self._process_pending_hash(phone_hash)

        token = self._create_access_token(user.id)
        return user, token

    async def _process_pending_hash(self, phone_hash: str) -> list[UUID]:
        if not self._pending_repo:
            return []

        owners = await self._pending_repo.find_owners_by_hash(phone_hash)

        if owners:
            await self._pending_repo.remove_all_for_hash(phone_hash)

        return owners

    async def login(self, email: str, password: str) -> tuple[User, str]:
        try:
            user = await self._user_service.get_user_by_email(email)
        except UserNotFoundError:
            raise InvalidCredentialsError("Invalid email or password")

        if not self._user_service.verify_password(password, user.hashed_password):
            raise InvalidCredentialsError("Invalid email or password")

        token = self._create_access_token(user.id)
        return user, token

    async def get_current_user(self, token: str) -> User:
        try:
            payload = jwt.decode(
                token,
                settings.jwt.secret_key,
                algorithms=[settings.jwt.algorithm],
            )
            user_id: str = payload.get("sub")
            if user_id is None:
                raise InvalidTokenError("Token does not contain user identifier")
        except JWTError:
            raise InvalidTokenError("Invalid token")

        try:
            user = await self._user_service.get_user(UUID(user_id))
        except UserNotFoundError:
            raise InvalidTokenError("User not found")

        return user

    async def get_user_by_id(self, user_id: UUID) -> User:
        """Fetch user by id for refresh flows."""
        try:
            return await self._user_service.get_user(user_id)
        except UserNotFoundError:
            raise InvalidTokenError("User not found")

    @staticmethod
    def _create_access_token(user_id: UUID) -> str:
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

    @staticmethod
    def create_access_token(user_id: UUID) -> str:
        return AuthService._create_access_token(user_id)

    @staticmethod
    def create_refresh_token(user_id: UUID) -> str:
        expire = datetime.now(timezone.utc) + timedelta(
            days=settings.jwt.refresh_token_expire_days
        )
        to_encode = {
            "sub": str(user_id),
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "refresh",
        }
        return jwt.encode(
            to_encode,
            settings.jwt.secret_key,
            algorithm=settings.jwt.algorithm,
        )

    @staticmethod
    def verify_refresh_token(token: str) -> UUID:
        try:
            payload = jwt.decode(
                token,
                settings.jwt.secret_key,
                algorithms=[settings.jwt.algorithm],
            )
            token_type = payload.get("type")
            user_id = payload.get("sub")
            if token_type != "refresh" or not user_id:
                raise InvalidTokenError("Invalid refresh token")
            return UUID(user_id)
        except (JWTError, ValueError):
            raise InvalidTokenError("Invalid refresh token")
