import { Modal, Avatar, Button, Tag } from "@/shared";
import type { UserPublic, ContactInfo } from "@/entities/user";
import { getFullName } from "@/entities/user";
import "./SpecialistModal.scss";

interface SpecialistModalProps {
  user: UserPublic | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveContact?: (user: UserPublic) => void;
  onDeleteContact?: (user: UserPublic) => void;
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
  isOpen,
  onClose,
  onSaveContact,
  onDeleteContact,
  isSaved = false,
}: SpecialistModalProps) {
  if (!user) return null;

  const fullName = getFullName(user);
  const bio = user.bio || user.ai_generated_bio;
  const contacts = user.contacts || [];

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

      {user.tags.length > 0 && (
        <div className="specialist-modal__section">
          <h3 className="specialist-modal__section-title">Навыки</h3>
          <div className="specialist-modal__tags">
            {user.tags.map((tag) => (
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
          <Button variant="danger" onClick={() => onDeleteContact(user)}>
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
