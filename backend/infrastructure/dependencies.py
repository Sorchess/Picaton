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
    MongoEmailVerificationRepository,
    MongoSkillEndorsementRepository,
)
from infrastructure.database.repositories.company_role import MongoCompanyRoleRepository
from infrastructure.database.repositories.company_card import MongoCompanyCardRepository
from infrastructure.database.repositories.company_tag_settings import MongoCompanyTagSettingsRepository
from infrastructure.database.repositories.pending_hash import MongoPendingHashRepository
from domain.repositories import (
    UserRepositoryInterface,
    SavedContactRepositoryInterface,
    BusinessCardRepositoryInterface,
    CompanyRepositoryInterface,
    CompanyMemberRepositoryInterface,
    CompanyInvitationRepositoryInterface,
    EmailVerificationRepositoryInterface,
    SkillEndorsementRepositoryInterface,
    ICompanyCardRepository,
    ICompanyTagSettingsRepository,
)
from domain.repositories.company_role import CompanyRoleRepositoryInterface
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
from application.services.gigachat_bio import GigaChatBioGenerator
from application.services.gigachat_tags import GigaChatTagsGenerator
from application.services.local_bio import LocalBioGenerator
from application.services.local_tags import LocalTagsGenerator
from application.services.ai_search import AISearchService
from application.services.card_title import CardTitleGenerator
from application.services.telegram_auth import TelegramAuthService
from application.services.email_verification import EmailVerificationService
from application.services.skill_endorsement import SkillEndorsementService
from application.services.company_role import CompanyRoleService
from application.services.permission_checker import PermissionChecker
from application.services.company_card import CompanyCardService, CompanyTagSettingsService
from application.services.gigachat_query_classifier import GigaChatQueryClassifier
from application.services.gigachat_task_decomposer import GigaChatTaskDecomposer
from application.services.gigachat_text_tags import GigaChatTextTagsGenerator
from infrastructure.llm.gigachat_client import GigaChatClient
from infrastructure.llm.local_llm_client import LocalLLMClient
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


def get_email_verification_repository(
    db: Database,
) -> EmailVerificationRepositoryInterface:
    """Получить репозиторий верификации email."""
    return MongoEmailVerificationRepository(db["email_verifications"])


UserRepository = Annotated[UserRepositoryInterface, Depends(get_user_repository)]
ContactRepository = Annotated[
    SavedContactRepositoryInterface, Depends(get_contact_repository)
]
PendingHashRepository = Annotated[
    PendingHashRepositoryInterface, Depends(get_pending_hash_repository)
]
EmailVerificationRepository = Annotated[
    EmailVerificationRepositoryInterface, Depends(get_email_verification_repository)
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


def get_company_role_repository(
    db: Database,
) -> CompanyRoleRepositoryInterface:
    """Получить репозиторий ролей компании."""
    return MongoCompanyRoleRepository(db["company_roles"])


CompanyRoleRepository = Annotated[
    CompanyRoleRepositoryInterface, Depends(get_company_role_repository)
]


def get_skill_endorsement_repository(
    db: Database,
) -> SkillEndorsementRepositoryInterface:
    """Получить репозиторий подтверждений навыков."""
    return MongoSkillEndorsementRepository(db["skill_endorsements"])


SkillEndorsementRepository = Annotated[
    SkillEndorsementRepositoryInterface, Depends(get_skill_endorsement_repository)
]


def get_company_card_repository(
    db: Database,
) -> ICompanyCardRepository:
    """Получить репозиторий корпоративных карточек."""
    return MongoCompanyCardRepository(db["company_cards"])


def get_company_tag_settings_repository(
    db: Database,
) -> ICompanyTagSettingsRepository:
    """Получить репозиторий настроек тегов компании."""
    return MongoCompanyTagSettingsRepository(db["company_tag_settings"])


CompanyCardRepository = Annotated[
    ICompanyCardRepository, Depends(get_company_card_repository)
]
CompanyTagSettingsRepository = Annotated[
    ICompanyTagSettingsRepository, Depends(get_company_tag_settings_repository)
]


# ==================== Сервисы ====================


def get_ai_bio_service() -> AIBioGeneratorService:
    """
    Получить сервис AI генерации биографии.

    Приоритет:
    1. Локальная модель (T-lite) если enabled
    2. GigaChat API если credentials настроены
    3. Fallback на rule-based генератор
    """
    if settings.local_llm.enabled:
        return AIBioGeneratorService(LocalBioGenerator())
    if settings.gigachat.credentials:
        return AIBioGeneratorService(GigaChatBioGenerator())
    return AIBioGeneratorService(AIBioGenerator())


def get_ai_tags_service() -> AITagsGeneratorService:
    """
    Получить сервис AI генерации тегов.

    Приоритет:
    1. Локальная модель (T-lite) если enabled
    2. GigaChat API если credentials настроены
    3. Fallback на rule-based генератор
    """
    if settings.local_llm.enabled:
        return AITagsGeneratorService(LocalTagsGenerator())
    if settings.gigachat.credentials:
        return AITagsGeneratorService(GigaChatTagsGenerator())
    return AITagsGeneratorService(MockAITagsGenerator())


def get_gigachat_bio_service() -> GigaChatBioGenerator:
    """
    Получить GigaChat сервис генерации биографий.

    Используется для генерации AI-презентаций для карточек.
    """
    return GigaChatBioGenerator()


def get_local_bio_service() -> LocalBioGenerator:
    """
    Получить локальный сервис генерации биографий.

    Используется для streaming генерации через WebSocket.
    """
    return LocalBioGenerator()


def get_local_tags_service() -> LocalTagsGenerator:
    """
    Получить локальный сервис генерации тегов.

    Используется для генерации тегов через локальную модель.
    """
    return LocalTagsGenerator()


def get_business_card_service(
    card_repo: BusinessCardRepository,
    user_repo: UserRepository,
) -> BusinessCardService:
    """Получить сервис визитных карточек."""
    return BusinessCardService(card_repo, user_repo)


def get_gigachat_tags_service() -> GigaChatTagsGenerator:
    """
    Получить GigaChat сервис генерации тегов для контактов.

    Используется для генерации тегов из заметок о контактах.
    """
    return GigaChatTagsGenerator()


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
    gigachat_client = GigaChatClient()
    return AISearchService(gigachat_client)


def get_gigachat_query_classifier() -> GigaChatQueryClassifier:
    """
    Получить сервис классификации запросов (task/skill).

    Используется для определения типа поискового запроса:
    - TASK: задача/проблема (например "создать сайт")
    - SKILL: навык/технология (например "python", "react разработчик")
    """
    gigachat_client = GigaChatClient()
    return GigaChatQueryClassifier(gigachat_client)


def get_gigachat_task_decomposer() -> GigaChatTaskDecomposer:
    """
    Получить сервис декомпозиции задач в теги.

    Используется для преобразования описания задачи в список навыков:
    "Нужно создать сайт" → ["веб-разработчик", "frontend", "html", "css", ...]
    """
    gigachat_client = GigaChatClient()
    return GigaChatTaskDecomposer(gigachat_client)


def get_gigachat_text_tags_service() -> GigaChatTextTagsGenerator:
    """
    Получить сервис генерации тегов из произвольного текста.

    Используется когда пользователь описывает свои навыки в свободной форме:
    "Я занимаюсь веб-разработкой, работаю с React и Python..."
    → ["веб-разработка", "react", "python", "frontend", "backend", ...]
    """
    gigachat_client = GigaChatClient()
    return GigaChatTextTagsGenerator(gigachat_client)


def get_search_service(
    user_repo: UserRepository,
    card_repo: BusinessCardRepository,
    contact_repo: ContactRepository,
    ai_search: AISearchService = Depends(get_ai_search_service),
    query_classifier: GigaChatQueryClassifier = Depends(get_gigachat_query_classifier),
    task_decomposer: GigaChatTaskDecomposer = Depends(get_gigachat_task_decomposer),
) -> AssociativeSearchService:
    """Получить сервис умного поиска с автоопределением типа запроса."""
    return AssociativeSearchService(
        user_repo,
        card_repo,
        contact_repo,
        ai_search,
        query_classifier,
        task_decomposer,
    )


def get_qrcode_service() -> QRCodeService:
    """Получить сервис QR-кодов."""
    # Используем frontend URL для ссылок в QR-кодах
    frontend_url = settings.magic_link.frontend_url or settings.api.url
    return QRCodeService(base_url=frontend_url)


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


def get_cloudinary_service() -> CloudinaryService:
    """Получить сервис Cloudinary для загрузки изображений."""
    return CloudinaryService()


def get_telegram_auth_service(
    user_repo: UserRepository,
    card_repo: BusinessCardRepository,
    user_service: UserService = Depends(get_user_service),
    cloudinary_service: CloudinaryService = Depends(get_cloudinary_service),
) -> TelegramAuthService:
    """Получить сервис Telegram авторизации."""
    return TelegramAuthService(
        user_repository=user_repo,
        user_service=user_service,
        jwt_secret=settings.jwt.secret_key,
        jwt_algorithm=settings.jwt.algorithm,
        access_token_expire_minutes=settings.jwt.access_token_expire_minutes,
        cloudinary_service=cloudinary_service,
        card_repository=card_repo,
    )


def get_email_verification_service(
    verification_repo: EmailVerificationRepository,
    user_repo: UserRepository,
) -> EmailVerificationService:
    """Получить сервис верификации email."""
    return EmailVerificationService(
        verification_repository=verification_repo,
        user_repository=user_repo,
    )


def get_company_service(
    company_repo: CompanyRepository,
    member_repo: CompanyMemberRepository,
    invitation_repo: CompanyInvitationRepository,
    user_repo: UserRepository,
    role_repo: CompanyRoleRepository,
) -> CompanyService:
    """Получить сервис управления компаниями."""
    return CompanyService(
        company_repo, member_repo, invitation_repo, user_repo, role_repo
    )


def get_permission_checker(
    role_repo: CompanyRoleRepository,
    member_repo: CompanyMemberRepository,
) -> PermissionChecker:
    """Получить сервис проверки прав доступа."""
    return PermissionChecker(role_repo, member_repo)


def get_company_role_service(
    role_repo: CompanyRoleRepository,
    company_repo: CompanyRepository,
    member_repo: CompanyMemberRepository,
    permission_checker: PermissionChecker = Depends(get_permission_checker),
) -> CompanyRoleService:
    """Получить сервис управления ролями в компании."""
    return CompanyRoleService(
        role_repo, company_repo, member_repo, permission_checker
    )


def get_skill_endorsement_service(
    endorsement_repo: SkillEndorsementRepository,
    card_repo: BusinessCardRepository,
    user_repo: UserRepository,
) -> SkillEndorsementService:
    """Получить сервис подтверждений навыков."""
    return SkillEndorsementService(endorsement_repo, card_repo, user_repo)


def get_company_tag_settings_service(
    tag_settings_repo: CompanyTagSettingsRepository,
) -> CompanyTagSettingsService:
    """Получить сервис настроек тегов компании."""
    return CompanyTagSettingsService(tag_settings_repo)


def get_company_card_service(
    card_repo: CompanyCardRepository,
    tag_settings_repo: CompanyTagSettingsRepository,
) -> CompanyCardService:
    """Получить сервис корпоративных карточек."""
    return CompanyCardService(card_repo, tag_settings_repo)


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
