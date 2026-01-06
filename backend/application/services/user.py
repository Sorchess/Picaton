from uuid import UUID
import bcrypt

from domain.entities.user import User
from domain.entities.tag import Tag
from domain.enums.contact import ContactType
from domain.exceptions import (
    UserNotFoundError,
    UserAlreadyExistsError,
    ConfigurationError,
    InvalidBioError,
)
from domain.repositories.user import UserRepositoryInterface
from application.services.ai_bio import AIBioGeneratorService
from application.services.ai_tags import AITagsGeneratorService


class UserService:
    """Сервис управления пользователями."""

    def __init__(
        self,
        user_repository: UserRepositoryInterface,
        ai_bio_service: AIBioGeneratorService | None = None,
        ai_tags_service: AITagsGeneratorService | None = None,
    ):
        self._user_repository = user_repository
        self._ai_bio_service = ai_bio_service
        self._ai_tags_service = ai_tags_service

    async def get_user(self, user_id: UUID) -> User:
        """Получить пользователя по ID."""
        user = await self._user_repository.get_by_id(user_id)
        if not user:
            raise UserNotFoundError(str(user_id))
        return user

    async def get_user_by_email(self, email: str) -> User:
        """Получить пользователя по email."""
        user = await self._user_repository.get_by_email(email)
        if not user:
            raise UserNotFoundError(email)
        return user

    async def create_user(
        self,
        email: str,
        password: str,
        first_name: str = "",
        last_name: str = "",
    ) -> User:
        """Создать нового пользователя."""
        # Проверяем, что пользователь с таким email не существует
        existing = await self._user_repository.get_by_email(email)
        if existing:
            raise UserAlreadyExistsError(email)

        # Хэшируем пароль
        hashed_password = self._hash_password(password)

        user = User(
            email=email,
            hashed_password=hashed_password,
            first_name=first_name,
            last_name=last_name,
        )

        return await self._user_repository.create(user)

    async def update_profile(
        self,
        user_id: UUID,
        first_name: str | None = None,
        last_name: str | None = None,
        avatar_url: str | None = None,
        bio: str | None = None,
    ) -> User:
        """Обновить профиль пользователя."""
        user = await self.get_user(user_id)
        user.update_profile(
            first_name=first_name,
            last_name=last_name,
            avatar_url=avatar_url,
            bio=bio,
        )
        return await self._user_repository.update(user)

    async def update_visibility(self, user_id: UUID, is_public: bool) -> User:
        """
        Изменить видимость профиля.

        Args:
            user_id: ID пользователя
            is_public: True - публичный профиль, False - приватный (только внутри компании)
        """
        user = await self.get_user(user_id)
        user.is_public = is_public
        return await self._user_repository.update(user)

    async def update_email(self, user_id: UUID, email: str) -> User:
        """
        Обновить email пользователя.

        Args:
            user_id: ID пользователя
            email: Новый email адрес
        """
        user = await self.get_user(user_id)
        user.email = email
        return await self._user_repository.update(user)

    async def add_random_fact(self, user_id: UUID, fact: str) -> User:
        """Добавить рандомный факт о пользователе."""
        user = await self.get_user(user_id)
        user.add_random_fact(fact)
        return await self._user_repository.update(user)

    async def generate_ai_bio(self, user_id: UUID) -> User:
        """Сгенерировать AI-презентацию на основе фактов."""
        if not self._ai_bio_service:
            raise ConfigurationError("AI bio service")

        user = await self.get_user(user_id)
        bio = await self._ai_bio_service.generate_bio_from_user(user)
        user.set_ai_generated_bio(bio)
        return await self._user_repository.update(user)

    async def update_search_tags(self, user_id: UUID, tags: list[str]) -> User:
        """Обновить теги для поиска."""
        user = await self.get_user(user_id)
        user.set_search_tags(tags)

        # Синхронизируем tags с search_tags
        from domain.entities.tag import Tag

        new_tags = []
        for tag_name in tags:
            tag = Tag(
                name=tag_name,
                category="Выбрано",
                proficiency=3,
            )
            new_tags.append(tag)
        user.tags = new_tags

        return await self._user_repository.update(user)

    async def generate_tags_from_bio(self, user_id: UUID) -> User:
        """Сгенерировать теги и навыки из bio пользователя."""
        if not self._ai_tags_service:
            raise ConfigurationError("AI tags service")

        user = await self.get_user(user_id)
        if not user.bio:
            raise InvalidBioError("Сначала заполните информацию о себе")

        result = await self._ai_tags_service.generate_from_bio(user.bio)

        # Обновляем теги для поиска
        user.set_search_tags(result.tags)

        # Добавляем навыки как теги
        new_tags = []
        for skill in result.skills:
            tag = Tag(
                name=skill["name"],
                category=skill["category"],
                proficiency=skill["proficiency"],
            )
            new_tags.append(tag)

        user.tags = new_tags

        return await self._user_repository.update(user)

    async def apply_selected_tags(
        self,
        user_id: UUID,
        selected_tags: list[str],
        bio: str | None = None,
    ) -> User:
        """
        Применить выбранные пользователем теги.

        Args:
            user_id: ID пользователя
            selected_tags: Список выбранных тегов
            bio: Опционально обновить bio
        """
        user = await self.get_user(user_id)

        # Обновляем bio если передано
        if bio is not None:
            user.update_profile(bio=bio)

        # Устанавливаем выбранные теги для поиска
        user.set_search_tags([tag.lower() for tag in selected_tags])

        # Создаём теги как навыки с базовым профiciency
        new_tags = []
        for tag_name in selected_tags:
            tag = Tag(
                name=tag_name,
                category="Выбрано",
                proficiency=3,  # Средний уровень по умолчанию
            )
            new_tags.append(tag)

        user.tags = new_tags

        return await self._user_repository.update(user)

    async def delete_user(self, user_id: UUID) -> bool:
        """Удалить пользователя."""
        return await self._user_repository.delete(user_id)

    async def list_users(self, skip: int = 0, limit: int = 100) -> list[User]:
        """Получить список пользователей."""
        return await self._user_repository.get_all(skip, limit)

    # ============ User Profile Contacts ============

    async def add_contact(
        self,
        user_id: UUID,
        contact_type: str,
        value: str,
        is_primary: bool = False,
        is_visible: bool = True,
    ) -> User:
        """Добавить контакт в профиль пользователя."""
        user = await self.get_user(user_id)
        ct = ContactType(contact_type.upper())
        user.add_contact(ct, value, is_primary, is_visible)
        return await self._user_repository.update(user)

    async def remove_contact(
        self,
        user_id: UUID,
        contact_type: str,
        value: str,
    ) -> User:
        """Удалить контакт из профиля пользователя."""
        user = await self.get_user(user_id)
        ct = ContactType(contact_type.upper())
        user.remove_contact(ct, value)
        return await self._user_repository.update(user)

    async def update_contact_visibility(
        self,
        user_id: UUID,
        contact_type: str,
        value: str,
        is_visible: bool,
    ) -> User:
        """Обновить видимость контакта."""
        user = await self.get_user(user_id)
        ct = ContactType(contact_type.upper())
        user.update_contact_visibility(ct, value, is_visible)
        return await self._user_repository.update(user)

    @staticmethod
    def _hash_password(password: str) -> str:
        """Хэширование пароля."""
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    @staticmethod
    def verify_password(password: str, hashed: str) -> bool:
        """Проверка пароля."""
        return bcrypt.checkpw(password.encode(), hashed.encode())
