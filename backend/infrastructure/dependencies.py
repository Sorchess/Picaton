from typing import Annotated

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from infrastructure.database.client import mongodb_client, MongoDBClient
from infrastructure.database.repositories import (
    MongoUserRepository,
    MongoSavedContactRepository,
    MongoBusinessCardRepository,
    MongoCompanyRepository,
    MongoCompanyMemberRepository,
    MongoCompanyInvitationRepository,
)
from infrastructure.database.repositories.pending_hash import MongoPendingHashRepository
from domain.repositories import (
    UserRepositoryInterface,
    SavedContactRepositoryInterface,
    BusinessCardRepositoryInterface,
    CompanyRepositoryInterface,
    CompanyMemberRepositoryInterface,
    CompanyInvitationRepositoryInterface,
)
from domain.repositories.pending_hash import PendingHashRepositoryInterface
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
    ContactSyncService,
    AuthService,
    MagicLinkService,
    CompanyService,
)
from application.services.business_card import BusinessCardService
from application.services.groq_bio import GroqBioGenerator
from application.services.groq_tags import GroqTagsGenerator
from application.services.ai_search import AISearchService
from application.services.card_title import CardTitleGenerator
from infrastructure.llm.groq_client import GroqClient
from infrastructure.storage import CloudinaryService
from infrastructure.email import SmtpEmailBackend
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


def get_pending_hash_repository(
    db: Database,
) -> PendingHashRepositoryInterface:
    """Получить репозиторий pending хешей."""
    return MongoPendingHashRepository(db["pending_hashes"])


UserRepository = Annotated[UserRepositoryInterface, Depends(get_user_repository)]
ContactRepository = Annotated[
    SavedContactRepositoryInterface, Depends(get_contact_repository)
]
PendingHashRepository = Annotated[
    PendingHashRepositoryInterface, Depends(get_pending_hash_repository)
]


def get_business_card_repository(
    db: Database,
) -> BusinessCardRepositoryInterface:
    """Получить репозиторий визитных карточек."""
    return MongoBusinessCardRepository(db["business_cards"])


BusinessCardRepository = Annotated[
    BusinessCardRepositoryInterface, Depends(get_business_card_repository)
]


def get_company_repository(
    db: Database,
) -> CompanyRepositoryInterface:
    """Получить репозиторий компаний."""
    return MongoCompanyRepository(db["companies"])


def get_company_member_repository(
    db: Database,
) -> CompanyMemberRepositoryInterface:
    """Получить репозиторий членов компании."""
    return MongoCompanyMemberRepository(db["company_members"])


def get_company_invitation_repository(
    db: Database,
) -> CompanyInvitationRepositoryInterface:
    """Получить репозиторий приглашений в компанию."""
    return MongoCompanyInvitationRepository(db["company_invitations"])


CompanyRepository = Annotated[
    CompanyRepositoryInterface, Depends(get_company_repository)
]
CompanyMemberRepository = Annotated[
    CompanyMemberRepositoryInterface, Depends(get_company_member_repository)
]
CompanyInvitationRepository = Annotated[
    CompanyInvitationRepositoryInterface, Depends(get_company_invitation_repository)
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


def get_groq_bio_service() -> GroqBioGenerator:
    """
    Получить Groq сервис генерации биографий.

    Используется для генерации AI-презентаций для карточек.
    """
    return GroqBioGenerator()


def get_business_card_service(
    card_repo: BusinessCardRepository,
    user_repo: UserRepository,
) -> BusinessCardService:
    """Получить сервис визитных карточек."""
    return BusinessCardService(card_repo, user_repo)


def get_groq_tags_service() -> GroqTagsGenerator:
    """
    Получить Groq сервис генерации тегов для контактов.

    Используется для генерации тегов из заметок о контактах.
    """
    return GroqTagsGenerator()


def get_card_title_generator() -> CardTitleGenerator:
    """
    Получить генератор названий для визитных карточек.

    Используется для автоматической генерации названий карточек
    на основе информации о пользователе.
    """
    return CardTitleGenerator()


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
    card_repo: BusinessCardRepository,
) -> SavedContactService:
    """Получить сервис сохраненных контактов."""
    return SavedContactService(contact_repo, user_repo, card_repo)


def get_ai_search_service() -> AISearchService:
    """Получить AI-сервис для расширения поисковых запросов."""
    groq_client = GroqClient()
    return AISearchService(groq_client)


def get_search_service(
    user_repo: UserRepository,
    card_repo: BusinessCardRepository,
    contact_repo: ContactRepository,
    ai_search: AISearchService = Depends(get_ai_search_service),
) -> AssociativeSearchService:
    """Получить сервис ассоциативного поиска с AI-расширением."""
    return AssociativeSearchService(user_repo, card_repo, contact_repo, ai_search)


def get_qrcode_service() -> QRCodeService:
    """Получить сервис QR-кодов."""
    # TODO: Получить base_url из конфига
    return QRCodeService(base_url=settings.api.url)


def get_import_service(
    contact_repo: ContactRepository,
) -> ContactImportService:
    """Получить сервис импорта контактов."""
    return ContactImportService(contact_repo)


def get_contact_sync_service(
    user_repo: UserRepository,
    pending_repo: PendingHashRepository,
) -> ContactSyncService:
    """Получить сервис синхронизации контактов с поддержкой pending хешей."""
    return ContactSyncService(user_repo, pending_repo)


def get_auth_service(
    user_repo: UserRepository,
    pending_repo: PendingHashRepository,
    user_service: UserService = Depends(get_user_service),
) -> AuthService:
    """Получить сервис аутентификации с поддержкой pending хешей."""
    return AuthService(user_repo, user_service, pending_repo)


def get_magic_link_service(
    user_repo: UserRepository,
) -> MagicLinkService:
    """Получить сервис magic link авторизации."""
    return MagicLinkService(user_repo)


def get_company_service(
    company_repo: CompanyRepository,
    member_repo: CompanyMemberRepository,
    invitation_repo: CompanyInvitationRepository,
    user_repo: UserRepository,
) -> CompanyService:
    """Получить сервис управления компаниями."""
    return CompanyService(company_repo, member_repo, invitation_repo, user_repo)


def get_cloudinary_service() -> CloudinaryService:
    """Получить сервис Cloudinary для загрузки изображений."""
    return CloudinaryService()


def get_email_service() -> SmtpEmailBackend | None:
    """
    Получить сервис отправки email.

    Returns:
        SmtpEmailBackend если email настроен, иначе None.
    """
    return SmtpEmailBackend(
        smtp_host=settings.email.smtp_host,
        smtp_port=settings.email.smtp_port,
        smtp_user=settings.email.smtp_user,
        smtp_password=settings.email.smtp_password,
        from_email=settings.email.from_email,
        from_name=settings.email.from_name,
        use_tls=settings.email.use_tls,
    )


EmailServiceDep = Annotated[SmtpEmailBackend | None, Depends(get_email_service)]
