from typing import Annotated

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from infrastructure.database.client import mongodb_client, MongoDBClient
from infrastructure.database.repositories import (
    MongoUserRepository,
    MongoSavedContactRepository,
)
from domain.repositories import UserRepositoryInterface, SavedContactRepositoryInterface
from application.services import (
    UserService,
    SavedContactService,
    AssociativeSearchService,
    QRCodeService,
    AIBioGeneratorService,
    AIBioGenerator,
    AITagsGeneratorService,
    MockAITagsGenerator,
    ContactImportService,
    AuthService,
)
from application.services.groq_bio import GroqBioGenerator
from application.services.groq_tags import GroqTagsGenerator
from settings.config import settings


# ==================== База данных ====================


def get_mongodb_client() -> MongoDBClient:
    """Получить клиент MongoDB."""
    return mongodb_client


def get_database(
    client: MongoDBClient = Depends(get_mongodb_client),
) -> AsyncIOMotorDatabase:
    """Получить базу данных MongoDB."""
    return client.database


Database = Annotated[AsyncIOMotorDatabase, Depends(get_database)]


# ==================== Репозитории ====================


def get_user_repository(
    db: Database,
) -> UserRepositoryInterface:
    """Получить репозиторий пользователей."""
    return MongoUserRepository(db["users"])


def get_contact_repository(
    db: Database,
) -> SavedContactRepositoryInterface:
    """Получить репозиторий сохраненных контактов."""
    return MongoSavedContactRepository(db["saved_contacts"])


UserRepository = Annotated[UserRepositoryInterface, Depends(get_user_repository)]
ContactRepository = Annotated[
    SavedContactRepositoryInterface, Depends(get_contact_repository)
]


# ==================== Сервисы ====================


def get_ai_bio_service() -> AIBioGeneratorService:
    """
    Получить сервис AI генерации биографии.

    Использует Groq LLM если API ключ настроен,
    иначе fallback на локальный ONNX генератор.
    """
    if settings.groq.api_key:
        return AIBioGeneratorService(GroqBioGenerator())
    return AIBioGeneratorService(AIBioGenerator())


def get_ai_tags_service() -> AITagsGeneratorService:
    """
    Получить сервис AI генерации тегов.

    Использует Groq LLM если API ключ настроен,
    иначе fallback на rule-based генератор.
    """
    if settings.groq.api_key:
        return AITagsGeneratorService(GroqTagsGenerator())
    return AITagsGeneratorService(MockAITagsGenerator())


def get_groq_tags_service() -> GroqTagsGenerator:
    """
    Получить Groq сервис генерации тегов для контактов.

    Используется для генерации тегов из заметок о контактах.
    """
    return GroqTagsGenerator()


def get_user_service(
    user_repo: UserRepository,
    ai_bio_service: AIBioGeneratorService = Depends(get_ai_bio_service),
    ai_tags_service: AITagsGeneratorService = Depends(get_ai_tags_service),
) -> UserService:
    """Получить сервис пользователей."""
    return UserService(user_repo, ai_bio_service, ai_tags_service)


def get_contact_service(
    contact_repo: ContactRepository,
    user_repo: UserRepository,
) -> SavedContactService:
    """Получить сервис сохраненных контактов."""
    return SavedContactService(contact_repo, user_repo)


def get_search_service(
    user_repo: UserRepository,
    contact_repo: ContactRepository,
) -> AssociativeSearchService:
    """Получить сервис ассоциативного поиска."""
    return AssociativeSearchService(user_repo, contact_repo)


def get_qrcode_service() -> QRCodeService:
    """Получить сервис QR-кодов."""
    # TODO: Получить base_url из конфига
    return QRCodeService(base_url=settings.api.url)


def get_import_service(
    contact_repo: ContactRepository,
) -> ContactImportService:
    """Получить сервис импорта контактов."""
    return ContactImportService(contact_repo)


def get_auth_service(
    user_repo: UserRepository,
    user_service: UserService = Depends(get_user_service),
) -> AuthService:
    """Получить сервис аутентификации."""
    return AuthService(user_repo, user_service)
