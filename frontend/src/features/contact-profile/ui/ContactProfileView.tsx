import { useState, useEffect, useCallback } from "react";
import {
  Avatar,
  Button,
  Tag,
  EndorsableSkill,
  IconButton,
  Tabs,
  Loader,
} from "@/shared";
import type { UserPublic, ContactInfo } from "@/entities/user";
import { getFullName } from "@/entities/user";
import {
  businessCardApi,
  type BusinessCardPublic,
} from "@/entities/business-card";
import { useAuth } from "@/features/auth";
import { endorsementApi } from "@/api/endorsementApi";
import type { SkillWithEndorsements } from "@/api/endorsementApi";
import "./ContactProfileView.scss";

interface ContactProfileViewProps {
  user: UserPublic;
  cardId?: string; // ID карточки для эндорсментов
  cardIds?: string[]; // Массив ID карточек для предпросмотра нескольких
  onClose: () => void;
  onSaveContact?: (user: UserPublic) => void;
  onDeleteContact?: ((user: UserPublic) => void) | (() => void);
  isSaved?: boolean;
  /** If true, only show the specified cardId without tabs for switching */
  singleCardMode?: boolean;
}

interface RoleTab {
  id: string;
  name: string;
  emoji: string;
}

// Иконки и лейблы для типов контактов
const CONTACT_ICONS: Record<
  string,
  { icon: string; label: string; getLink: (value: string) => string }
> = {
  telegram: {
    icon: "telegram",
    label: "Telegram",
    getLink: (v) =>
      v.startsWith("@") ? `https://t.me/${v.slice(1)}` : `https://t.me/${v}`,
  },
  whatsapp: {
    icon: "whatsapp",
    label: "WhatsApp",
    getLink: (v) => `https://wa.me/${v.replace(/\D/g, "")}`,
  },
  vk: {
    icon: "vk",
    label: "ВКонтакте",
    getLink: (v) => (v.startsWith("http") ? v : `https://vk.com/${v}`),
  },
  messenger: {
    icon: "messenger",
    label: "Messenger",
    getLink: (v) => `https://m.me/${v}`,
  },
  email: {
    icon: "email",
    label: "Email",
    getLink: (v) => `mailto:${v}`,
  },
  phone: {
    icon: "phone",
    label: "Телефон",
    getLink: (v) => `tel:${v.replace(/\D/g, "")}`,
  },
  linkedin: {
    icon: "linkedin",
    label: "LinkedIn",
    getLink: (v) => (v.startsWith("http") ? v : `https://linkedin.com/in/${v}`),
  },
  github: {
    icon: "github",
    label: "GitHub",
    getLink: (v) => (v.startsWith("http") ? v : `https://github.com/${v}`),
  },
  instagram: {
    icon: "instagram",
    label: "Instagram",
    getLink: (v) =>
      v.startsWith("http") ? v : `https://instagram.com/${v.replace("@", "")}`,
  },
  tiktok: {
    icon: "tiktok",
    label: "TikTok",
    getLink: (v) =>
      v.startsWith("http") ? v : `https://tiktok.com/@${v.replace("@", "")}`,
  },
};

function ContactLink({ contact }: { contact: ContactInfo }) {
  const config = CONTACT_ICONS[contact.type.toLowerCase()] || {
    icon: "link",
    label: contact.type,
    getLink: () => "#",
  };

  return (
    <a
      href={config.getLink(contact.value)}
      target="_blank"
      rel="noopener noreferrer"
      className="contact-profile-view__contact"
    >
      <span
        className={`contact-profile-view__contact-icon contact-profile-view__contact-icon--${config.icon}`}
      />
      <span className="contact-profile-view__contact-value">
        {contact.value}
      </span>
    </a>
  );
}

export function ContactProfileView({
  user,
  cardId: initialCardId,
  cardIds,
  onClose,
  onSaveContact,
  onDeleteContact,
  isSaved = false,
  singleCardMode = false,
}: ContactProfileViewProps) {
  const { user: authUser } = useAuth();

  // Карточки контакта
  const [cards, setCards] = useState<BusinessCardPublic[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(
    initialCardId || null,
  );

  // Эндорсменты
  const [skillsWithEndorsements, setSkillsWithEndorsements] = useState<
    SkillWithEndorsements[]
  >([]);
  const [endorseLoading, setEndorseLoading] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);

  // Загрузка всех карточек контакта
  const loadCards = useCallback(async () => {
    if (!user.id) return;

    // Если передан массив cardIds - загружаем только эти карточки
    if (cardIds && cardIds.length > 0) {
      setIsLoadingCards(true);
      try {
        const cardPromises = cardIds.map((id) => businessCardApi.getPublic(id));
        const cardDataList = await Promise.all(cardPromises);
        const publicCards: BusinessCardPublic[] = cardDataList.map(
          (cardData) => ({
            id: cardData.id,
            owner_id: cardData.owner_id,
            display_name: cardData.display_name,
            avatar_url: cardData.avatar_url,
            bio: cardData.bio,
            ai_generated_bio: cardData.ai_generated_bio,
            tags: cardData.tags,
            search_tags: cardData.search_tags,
            contacts: cardData.contacts,
            completeness: cardData.completeness,
            is_primary: cardData.is_primary,
            title: cardData.title,
            emojis: cardData.emojis || [],
          }),
        );
        setCards(publicCards);
        // Устанавливаем первую карточку как активную
        if (!activeCardId && publicCards.length > 0) {
          setActiveCardId(publicCards[0].id);
        }
      } catch (error) {
        console.error("Failed to load cards:", error);
      } finally {
        setIsLoadingCards(false);
      }
      return;
    }

    // В режиме одной карточки загружаем только её
    if (singleCardMode && initialCardId) {
      setIsLoadingCards(true);
      try {
        const cardData = await businessCardApi.getPublic(initialCardId);
        const publicCard: BusinessCardPublic = {
          id: cardData.id,
          owner_id: cardData.owner_id,
          display_name: cardData.display_name,
          avatar_url: cardData.avatar_url,
          bio: cardData.bio,
          ai_generated_bio: cardData.ai_generated_bio,
          tags: cardData.tags,
          search_tags: cardData.search_tags,
          contacts: cardData.contacts,
          completeness: cardData.completeness,
          is_primary: cardData.is_primary,
          title: cardData.title,
          emojis: cardData.emojis || [],
        };
        setCards([publicCard]);
        setActiveCardId(initialCardId);
      } catch (error) {
        console.error("Failed to load card:", error);
      } finally {
        setIsLoadingCards(false);
      }
      return;
    }

    setIsLoadingCards(true);
    try {
      const response = await businessCardApi.getAll(user.id);
      const publicCards = response.cards.map((card) => ({
        id: card.id,
        owner_id: card.owner_id,
        display_name: card.display_name,
        avatar_url: card.avatar_url,
        bio: card.bio,
        ai_generated_bio: card.ai_generated_bio,
        tags: card.tags,
        search_tags: card.search_tags,
        contacts: card.contacts,
        completeness: card.completeness,
        is_primary: card.is_primary,
        title: card.title,
      })) as BusinessCardPublic[];

      setCards(publicCards);

      // Устанавливаем активную карточку
      if (!activeCardId && publicCards.length > 0) {
        // Если есть начальная карточка - используем её, иначе primary или первую
        if (initialCardId) {
          setActiveCardId(initialCardId);
        } else {
          const primaryCard = publicCards.find((c) => c.is_primary);
          setActiveCardId(primaryCard?.id || publicCards[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to load contact cards:", error);
      // Если не удалось загрузить карточки, используем данные из user
    } finally {
      setIsLoadingCards(false);
    }
  }, [user.id, activeCardId, initialCardId, singleCardMode, cardIds]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Загрузка навыков с эндорсментами для активной карточки
  const loadSkillsWithEndorsements = useCallback(async () => {
    if (!activeCardId) return;

    try {
      const data = await endorsementApi.getCardSkills(
        activeCardId,
        authUser?.id,
      );
      setSkillsWithEndorsements(data.skills);
    } catch (error) {
      console.error("Failed to load skill endorsements:", error);
    }
  }, [activeCardId, authUser?.id]);

  useEffect(() => {
    if (activeCardId) {
      loadSkillsWithEndorsements();
    }
  }, [activeCardId, loadSkillsWithEndorsements]);

  // Toggle endorsement
  const handleToggleEndorse = useCallback(
    async (tagId: string) => {
      if (!authUser?.id || !activeCardId) return;

      setEndorseLoading(tagId);
      try {
        const result = await endorsementApi.toggle(
          authUser.id,
          activeCardId,
          tagId,
        );

        setSkillsWithEndorsements((prev) => {
          const newSkills: SkillWithEndorsements[] = [];

          for (const skill of prev) {
            if (String(skill.tag_id) !== String(tagId)) {
              newSkills.push({ ...skill });
            } else {
              const updatedEndorsers = [...skill.endorsers];

              if (result.is_endorsed) {
                const currentUserEndorser = {
                  id: authUser.id,
                  name:
                    `${authUser.first_name || ""} ${authUser.last_name || ""}`.trim() ||
                    "Вы",
                  avatar_url: authUser.avatar_url || null,
                };
                if (!updatedEndorsers.some((e) => e.id === authUser.id)) {
                  updatedEndorsers.unshift(currentUserEndorser);
                }
              } else {
                const idx = updatedEndorsers.findIndex(
                  (e) => e.id === authUser.id,
                );
                if (idx !== -1) updatedEndorsers.splice(idx, 1);
              }

              newSkills.push({
                tag_id: skill.tag_id,
                tag_name: skill.tag_name,
                tag_category: skill.tag_category,
                proficiency: skill.proficiency,
                endorsed_by_current_user: result.is_endorsed,
                endorsement_count: result.endorsement_count,
                endorsers: updatedEndorsers.slice(0, 5),
              });
            }
          }

          return newSkills;
        });

        forceUpdate((n) => n + 1);
      } catch (error) {
        console.error("Failed to toggle endorsement:", error);
      } finally {
        setEndorseLoading(null);
      }
    },
    [authUser, activeCardId],
  );

  // Получить текущую активную карточку
  const getActiveCard = (): BusinessCardPublic | null => {
    if (cards.length === 0) return null;
    return cards.find((c) => c.id === activeCardId) || cards[0];
  };

  // Генерация табов из карточек
  const generateRoleTabs = (): RoleTab[] => {
    return cards.map((card) => ({
      id: card.id,
      name: card.is_primary ? "Личный" : card.title || "Визитка",
      emoji: card.is_primary ? "🔥" : "🌟",
    }));
  };

  const activeCard = getActiveCard();
  const fullName = activeCard?.display_name || getFullName(user);
  // Используем аватар из активной карточки, с fallback на аватар пользователя
  const displayAvatar = activeCard?.avatar_url || user.avatar_url;
  // Bio берём только из активной карточки, если карточки загружены
  const bio =
    cards.length > 0
      ? activeCard?.bio || activeCard?.ai_generated_bio
      : user.bio || user.ai_generated_bio;
  const contacts = activeCard?.contacts || user.contacts || [];
  const displayTags = activeCard?.tags || user.tags || [];
  const displaySearchTags = activeCard?.search_tags || user.search_tags || [];

  // Роли из тегов
  const getCardRoles = (): string[] => {
    const roles: string[] = [];

    if (activeCard && !activeCard.is_primary && activeCard.title) {
      roles.push(activeCard.title);
    }

    if (displayTags.length > 0) {
      displayTags.slice(0, 3).forEach((tag) => {
        roles.push(tag.name);
      });
    }

    if (roles.length === 0 && user.position) {
      roles.push(user.position);
    }

    return roles.length > 0 ? roles : ["Пользователь"];
  };

  // Skills count
  const skillsCount = displayTags.length || 0;
  const recommendationsCount = skillsWithEndorsements.reduce(
    (acc, skill) => acc + skill.endorsement_count,
    0,
  );
  const userLevel =
    Math.floor(
      (activeCard?.completeness || user.profile_completeness || 0) / 4,
    ) + 1;

  // Проверяем, можно ли лайкать (нельзя лайкать свои навыки)
  const canEndorse = authUser?.id !== user.id;

  // Инициалы
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Если есть данные с эндорсментами - используем их
  const hasEndorsementData = skillsWithEndorsements.length > 0;
  const fallbackTags =
    displayTags.length > 0
      ? displayTags
      : displaySearchTags.map((name, idx) => ({
          id: `search-${idx}`,
          name,
        }));

  // Hobbies (from search tags)
  const hobbies = displaySearchTags.slice(0, 5).map((tag, i) => ({
    id: `hobby-${i}`,
    icon: "❤️",
    name: tag,
  }));

  const roleTabs = generateRoleTabs();

  return (
    <div className="contact-profile-view">
      {/* Top Bar */}
      <div className="contact-profile-view__top-bar">
        <IconButton onClick={onClose} aria-label="Назад">
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
            <path
              d="M9 1L1 9L9 17"
              stroke="black"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
        <span className="contact-profile-view__top-title">Профиль</span>
        <div className="contact-profile-view__top-spacer" />
      </div>

      {/* Content */}
      <div className="contact-profile-view__content">
        {/* Hero Block */}
        <div className="contact-profile-view__hero">
          {/* Floating emojis decoration */}
          <div className="contact-profile-view__emojis">
            {(getActiveCard()?.emojis || []).map((emoji, index) => (
              <span
                key={index}
                className={`contact-profile-view__emoji contact-profile-view__emoji--${index + 1}`}
              >
                <span className="contact-profile-view__emoji-blur">
                  {emoji}
                </span>
                <span className="contact-profile-view__emoji-main">
                  {emoji}
                </span>
              </span>
            ))}
          </div>

          {/* Avatar */}
          <div className="contact-profile-view__avatar">
            <div className="contact-profile-view__avatar-glow" />
            <Avatar
              src={displayAvatar || undefined}
              initials={getInitials(fullName)}
              size="lg"
              alt={fullName}
            />
          </div>

          {/* Name and roles */}
          <div className="contact-profile-view__info">
            <h1 className="contact-profile-view__name">{fullName}</h1>
            <div className="contact-profile-view__roles">
              {getCardRoles().map((role, index) => (
                <span key={index} className="contact-profile-view__role">
                  {index > 0 && (
                    <span className="contact-profile-view__dot">•</span>
                  )}
                  {role}
                </span>
              ))}
            </div>
          </div>

          {/* Stats badges */}
          <div className="contact-profile-view__stats">
            <span className="contact-profile-view__stat contact-profile-view__stat--skills">
              {skillsCount} Skills
            </span>
            <span className="contact-profile-view__stat contact-profile-view__stat--recommendations">
              {recommendationsCount} Рекомендаций
            </span>
            <span className="contact-profile-view__stat contact-profile-view__stat--level">
              {userLevel} Уровень
            </span>
          </div>
        </div>

        {/* Role Tabs - только если есть больше одной карточки и не в режиме одной карточки */}
        {!singleCardMode && roleTabs.length > 1 && activeCardId && (
          <Tabs
            tabs={roleTabs.map((role) => ({
              id: role.id,
              label: role.name,
              icon: role.emoji,
            }))}
            activeId={activeCardId}
            onChange={setActiveCardId}
            className="contact-profile-view__role-tabs"
          />
        )}

        {/* Bio Card */}
        {bio && (
          <div className="contact-profile-view__card">
            <span className="contact-profile-view__card-label">Bio</span>
            <p className="contact-profile-view__bio-text">{bio}</p>
          </div>
        )}

        {/* Skills Card */}
        {(hasEndorsementData || fallbackTags.length > 0) && (
          <div className="contact-profile-view__card">
            <div className="contact-profile-view__card-header">
              <span className="contact-profile-view__card-label">Skills</span>
              {canEndorse && hasEndorsementData && (
                <span className="contact-profile-view__card-hint">
                  Нажмите, чтобы подтвердить
                </span>
              )}
            </div>
            <div className="contact-profile-view__tags">
              {hasEndorsementData
                ? skillsWithEndorsements.map((skill) => (
                    <EndorsableSkill
                      key={`${skill.tag_id}-${skill.endorsement_count}-${skill.endorsed_by_current_user}`}
                      skill={skill}
                      onToggleEndorse={handleToggleEndorse}
                      canEndorse={canEndorse}
                      isLoading={endorseLoading === skill.tag_id}
                    />
                  ))
                : fallbackTags.map((tag) => (
                    <Tag key={tag.id} size="sm" variant="default">
                      {tag.name}
                    </Tag>
                  ))}
            </div>
          </div>
        )}

        {/* Contacts Card */}
        {contacts.length > 0 && (
          <div className="contact-profile-view__card">
            <span className="contact-profile-view__card-label">
              Контакты для связи
            </span>
            <div className="contact-profile-view__contacts">
              {contacts.map((contact, idx) => (
                <ContactLink key={idx} contact={contact} />
              ))}
            </div>
          </div>
        )}

        {contacts.length === 0 && (
          <div className="contact-profile-view__card">
            <p className="contact-profile-view__no-contacts">
              Пользователь не указал контакты для связи
            </p>
          </div>
        )}

        {/* Hobbies Card */}
        {hobbies.length > 0 && (
          <div className="contact-profile-view__card">
            <span className="contact-profile-view__card-label">Интересы</span>
            <div className="contact-profile-view__hobbies">
              {hobbies.map((hobby) => (
                <span key={hobby.id} className="contact-profile-view__hobby">
                  <span className="contact-profile-view__hobby-icon">
                    {hobby.icon}
                  </span>
                  {hobby.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="contact-profile-view__actions">
        {onSaveContact && !isSaved && authUser?.id !== user.id && (
          <Button variant="primary" onClick={() => onSaveContact(user)}>
            Сохранить в контакты
          </Button>
        )}
        {isSaved && onDeleteContact && authUser?.id !== user.id && (
          <Button
            variant="danger"
            onClick={() =>
              (onDeleteContact as (user: UserPublic) => void)(user)
            }
          >
            Удалить из контактов
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          Закрыть
        </Button>
      </div>

      {/* Loading overlay */}
      {isLoadingCards && (
        <div className="contact-profile-view__loading">
          <Loader />
        </div>
      )}
    </div>
  );
}
