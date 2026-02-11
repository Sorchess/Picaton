from infrastructure.database.repositories.user import MongoUserRepository
from infrastructure.database.repositories.saved_contact import (
    MongoSavedContactRepository,
)
from infrastructure.database.repositories.business_card import (
    MongoBusinessCardRepository,
)
from infrastructure.database.repositories.company import (
    MongoCompanyRepository,
    MongoCompanyMemberRepository,
    MongoCompanyInvitationRepository,
)
from infrastructure.database.repositories.email_verification import (
    MongoEmailVerificationRepository,
)
from infrastructure.database.repositories.skill_endorsement import (
    MongoSkillEndorsementRepository,
)
from infrastructure.database.repositories.company_card import (
    MongoCompanyCardRepository,
)
from infrastructure.database.repositories.company_tag_settings import (
    MongoCompanyTagSettingsRepository,
)
from infrastructure.database.repositories.idea import MongoIdeaRepository
from infrastructure.database.repositories.idea_swipe import MongoIdeaSwipeRepository
from infrastructure.database.repositories.project import MongoProjectRepository
from infrastructure.database.repositories.project_member import (
    MongoProjectMemberRepository,
)
from infrastructure.database.repositories.chat_message import (
    MongoChatMessageRepository,
)
from infrastructure.database.repositories.share_link import (
    MongoShareLinkRepository,
)
from infrastructure.database.repositories.conversation import (
    MongoConversationRepository,
)
from infrastructure.database.repositories.direct_message import (
    MongoDirectMessageRepository,
)

__all__ = [
    "MongoUserRepository",
    "MongoSavedContactRepository",
    "MongoBusinessCardRepository",
    "MongoCompanyRepository",
    "MongoCompanyMemberRepository",
    "MongoCompanyInvitationRepository",
    "MongoEmailVerificationRepository",
    "MongoSkillEndorsementRepository",
    "MongoCompanyCardRepository",
    "MongoCompanyTagSettingsRepository",
    # Ideas & Projects
    "MongoIdeaRepository",
    "MongoIdeaSwipeRepository",
    "MongoProjectRepository",
    "MongoProjectMemberRepository",
    "MongoChatMessageRepository",
    # Share Links
    "MongoShareLinkRepository",
    # Direct Messages
    "MongoConversationRepository",
    "MongoDirectMessageRepository",
]
