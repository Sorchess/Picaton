import { useState, useEffect, useCallback } from "react";
import { Modal, Avatar, Button, Tag, EndorsableSkill } from "@/shared";
import type { UserPublic, ContactInfo } from "@/entities/user";
import { getFullName } from "@/entities/user";
import { useAuth } from "@/features/auth";
import { endorsementApi } from "@/api/endorsementApi";
import type { SkillWithEndorsements } from "@/api/endorsementApi";
import "./SpecialistModal.scss";

interface SpecialistModalProps {
  user: UserPublic | null;
  cardId?: string; // ID карточки для эндорсментов
  isOpen: boolean;
  onClose: () => void;
  onSaveContact?: (user: UserPublic) => void;
  onDeleteContact?: ((user: UserPublic) => void) | (() => void);
  isSaved?: boolean;
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
      className="specialist-modal__contact"
    >
      <span
        className={`specialist-modal__contact-icon specialist-modal__contact-icon--${config.icon}`}
      />
      <span className="specialist-modal__contact-value">{contact.value}</span>
    </a>
  );
}

export function SpecialistModal({
  user,
  cardId,
  isOpen,
  onClose,
  onSaveContact,
  onDeleteContact,
  isSaved = false,
}: SpecialistModalProps) {
  const { user: authUser } = useAuth();
  const [skillsWithEndorsements, setSkillsWithEndorsements] = useState<
    SkillWithEndorsements[]
  >([]);
  const [endorseLoading, setEndorseLoading] = useState<string | null>(null);
  const [, forceUpdate] = useState(0); // Для принудительного ре-рендера

  // Сброс состояния при смене карточки или закрытии
  useEffect(() => {
    if (!isOpen) {
      setSkillsWithEndorsements([]);
    }
  }, [isOpen, cardId]);

  // Загрузка навыков с эндорсментами
  const loadSkillsWithEndorsements = useCallback(async () => {
    if (!cardId || !isOpen) return;

    try {
      const data = await endorsementApi.getCardSkills(cardId, authUser?.id);
      setSkillsWithEndorsements(data.skills);
    } catch (error) {
      console.error("Failed to load skill endorsements:", error);
      // Fallback - skills will be shown without endorsement data
    }
  }, [cardId, authUser?.id, isOpen]);

  useEffect(() => {
    if (isOpen && cardId) {
      loadSkillsWithEndorsements();
    }
  }, [isOpen, cardId, loadSkillsWithEndorsements]);

  // Toggle endorsement
  const handleToggleEndorse = useCallback(
    async (tagId: string) => {
      if (!authUser?.id || !cardId) return;

      setEndorseLoading(tagId);
      try {
        const result = await endorsementApi.toggle(authUser.id, cardId, tagId);

        // Update local state immediately - создаём полностью новый массив
        setSkillsWithEndorsements((prev) => {
          const newSkills: SkillWithEndorsements[] = [];

          for (const skill of prev) {
            if (String(skill.tag_id) !== String(tagId)) {
              // Создаём копию объекта
              newSkills.push({ ...skill });
            } else {
              // Создаём обновлённый список endorsers
              const updatedEndorsers = [...skill.endorsers];

              if (result.is_endorsed) {
                // Добавляем текущего пользователя в начало списка
                const currentUserEndorser = {
                  id: authUser.id,
                  name:
                    `${authUser.first_name || ""} ${
                      authUser.last_name || ""
                    }`.trim() || "Вы",
                  avatar_url: authUser.avatar_url || null,
                };
                // Проверяем, нет ли уже в списке
                if (!updatedEndorsers.some((e) => e.id === authUser.id)) {
                  updatedEndorsers.unshift(currentUserEndorser);
                }
              } else {
                // Удаляем текущего пользователя из списка
                const idx = updatedEndorsers.findIndex(
                  (e) => e.id === authUser.id
                );
                if (idx !== -1) updatedEndorsers.splice(idx, 1);
              }

              // Создаём полностью новый объект
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

        // Принудительный ре-рендер
        forceUpdate((n) => n + 1);
      } catch (error) {
        console.error("Failed to toggle endorsement:", error);
      } finally {
        setEndorseLoading(null);
      }
    },
    [authUser, cardId]
  );

  if (!user) return null;

  const fullName = getFullName(user);
  const bio = user.bio || user.ai_generated_bio;
  const contacts = user.contacts || [];

  // Проверяем, можно ли лайкать (нельзя лайкать свои навыки)
  const canEndorse = authUser?.id !== user.id;

  // Если есть данные с эндорсментами - используем их, иначе fallback на обычные теги
  const hasEndorsementData = skillsWithEndorsements.length > 0;
  const fallbackTags =
    user.tags && user.tags.length > 0
      ? user.tags
      : (user.search_tags || []).map((name, idx) => ({
          id: `search-${idx}`,
          name,
        }));

  // Генерируем инициалы из имени
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      className="specialist-modal"
    >
      <div className="specialist-modal__header">
        <Avatar
          src={user.avatar_url ?? undefined}
          alt={fullName}
          initials={getInitials(fullName)}
          size="xl"
          className="specialist-modal__avatar"
        />
        <div className="specialist-modal__info">
          <h2 className="specialist-modal__name">{fullName}</h2>
          {user.location && (
            <p className="specialist-modal__location">
              <span className="specialist-modal__location-icon" />
              {user.location}
            </p>
          )}
        </div>
      </div>

      {bio && (
        <div className="specialist-modal__section">
          <h3 className="specialist-modal__section-title">О себе</h3>
          <p className="specialist-modal__bio">{bio}</p>
        </div>
      )}

      {(hasEndorsementData || fallbackTags.length > 0) && (
        <div className="specialist-modal__section">
          <h3 className="specialist-modal__section-title">
            Навыки
            {canEndorse && hasEndorsementData && (
              <span className="specialist-modal__section-hint">
                Нажмите, чтобы подтвердить
              </span>
            )}
          </h3>
          <div className="specialist-modal__tags">
            {hasEndorsementData
              ? // Отображаем навыки с возможностью лайка
                skillsWithEndorsements.map((skill) => (
                  <EndorsableSkill
                    key={`${skill.tag_id}-${skill.endorsement_count}-${skill.endorsed_by_current_user}`}
                    skill={skill}
                    onToggleEndorse={handleToggleEndorse}
                    canEndorse={canEndorse}
                    isLoading={endorseLoading === skill.tag_id}
                  />
                ))
              : // Fallback - обычные теги без лайков
                fallbackTags.map((tag) => (
                  <Tag key={tag.id} size="sm" variant="default">
                    {tag.name}
                  </Tag>
                ))}
          </div>
        </div>
      )}

      {contacts.length > 0 && (
        <div className="specialist-modal__section">
          <h3 className="specialist-modal__section-title">
            Контакты для связи
          </h3>
          <div className="specialist-modal__contacts">
            {contacts.map((contact, idx) => (
              <ContactLink key={idx} contact={contact} />
            ))}
          </div>
        </div>
      )}

      {contacts.length === 0 && (
        <div className="specialist-modal__section">
          <p className="specialist-modal__no-contacts">
            Пользователь не указал контакты для связи
          </p>
        </div>
      )}

      <div className="specialist-modal__actions">
        {onSaveContact && !isSaved && (
          <Button variant="primary" onClick={() => onSaveContact(user)}>
            Сохранить в контакты
          </Button>
        )}
        {isSaved && onDeleteContact && (
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
    </Modal>
  );
}
