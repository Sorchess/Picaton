import type { FC, ReactNode } from "react";
import "./ProfileInfoCard.scss";

interface InfoField {
  /** Field label */
  label: string;
  /** Field value */
  value: string;
  /** Optional icon on the right */
  rightIcon?: ReactNode;
  /** On field click */
  onClick?: () => void;
}

interface HobbyTag {
  /** Hobby id */
  id: string;
  /** Hobby icon (emoji or SF Symbol) */
  icon: string;
  /** Hobby name */
  name: string;
}

interface ContactInfo {
  /** Contact type (phone, email, telegram, etc.) */
  type: string;
  /** Contact value */
  value: string;
  /** Is primary contact */
  is_primary?: boolean;
}

interface TagInfo {
  /** Tag id */
  id: string;
  /** Tag name */
  name: string;
  /** Tag category */
  category?: string;
}

interface ProfileInfoCardProps {
  /** Bio / About me */
  bio?: string;
  /** All contacts */
  contacts?: ContactInfo[];
  /** Skills / Tags */
  tags?: TagInfo[];
  /** Phone number (deprecated - use contacts) */
  phone?: string;
  /** Username */
  username?: string;
  /** On username click (copy/edit) */
  onUsernameClick?: () => void;
  /** Birth date */
  birthDate?: string;
  /** Hobbies list */
  hobbies?: HobbyTag[];
  /** Additional fields */
  additionalFields?: InfoField[];
  /** Additional CSS class */
  className?: string;
}

/**
 * Profile info cards with personal data (from Figma design)
 * Each section is a separate card
 */
export const ProfileInfoCard: FC<ProfileInfoCardProps> = ({
  bio,
  contacts = [],
  tags = [],
  phone,
  username,
  onUsernameClick,
  hobbies = [],
  className = "",
}) => {
  // Get phone from contacts or from prop
  const phoneContact = contacts.find((c) => c.type === "phone");
  const displayPhone = phoneContact?.value || phone;

  // Get other contacts (excluding phone)
  const otherContacts = contacts.filter((c) => c.type !== "phone");

  // Check if we have any content to show
  const hasContent =
    bio ||
    username ||
    tags.length > 0 ||
    displayPhone ||
    otherContacts.length > 0 ||
    hobbies.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <div className={`profile-info-cards ${className}`}>
      {/* Bio Card */}
      {bio && (
        <div className="profile-info-cards__card">
          <span className="profile-info-cards__label">Bio</span>
          <p className="profile-info-cards__bio-text">{bio}</p>
        </div>
      )}

      {/* Username Card */}
      {username && (
        <div
          className="profile-info-cards__card profile-info-cards__card--clickable"
          onClick={onUsernameClick}
        >
          <div className="profile-info-cards__row">
            <div className="profile-info-cards__content">
              <span className="profile-info-cards__label">Username</span>
              <span className="profile-info-cards__value">@{username}</span>
            </div>
            <span className="profile-info-cards__qr-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect
                  x="2"
                  y="2"
                  width="6"
                  height="6"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <rect
                  x="12"
                  y="2"
                  width="6"
                  height="6"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <rect
                  x="2"
                  y="12"
                  width="6"
                  height="6"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <rect x="12" y="12" width="2" height="2" fill="currentColor" />
                <rect x="16" y="12" width="2" height="2" fill="currentColor" />
                <rect x="12" y="16" width="2" height="2" fill="currentColor" />
                <rect x="16" y="16" width="2" height="2" fill="currentColor" />
                <rect x="14" y="14" width="2" height="2" fill="currentColor" />
              </svg>
            </span>
          </div>
        </div>
      )}

      {/* Skills Card */}
      {tags.length > 0 && (
        <div className="profile-info-cards__card">
          <span className="profile-info-cards__label">Skills</span>
          <div className="profile-info-cards__tags">
            {tags.map((tag) => (
              <span key={tag.id} className="profile-info-cards__tag">
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Phone Card */}
      {displayPhone && (
        <div className="profile-info-cards__card">
          <span className="profile-info-cards__label">Phone</span>
          <a
            href={`tel:${displayPhone}`}
            className="profile-info-cards__value profile-info-cards__value--link"
          >
            {displayPhone}
          </a>
        </div>
      )}

      {/* Other contacts cards */}
      {otherContacts.map((contact, index) => (
        <div
          key={`${contact.type}-${index}`}
          className="profile-info-cards__card"
        >
          <span className="profile-info-cards__label">
            {contact.type.charAt(0).toUpperCase() + contact.type.slice(1)}
          </span>
          {contact.type === "email" ? (
            <a
              href={`mailto:${contact.value}`}
              className="profile-info-cards__value profile-info-cards__value--link"
            >
              {contact.value}
            </a>
          ) : contact.type === "telegram" ? (
            <a
              href={`https://t.me/${contact.value.replace("@", "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="profile-info-cards__value profile-info-cards__value--link"
            >
              {contact.value.startsWith("@")
                ? contact.value
                : `@${contact.value}`}
            </a>
          ) : contact.type === "website" ? (
            <a
              href={
                contact.value.startsWith("http")
                  ? contact.value
                  : `https://${contact.value}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="profile-info-cards__value profile-info-cards__value--link"
            >
              {contact.value}
            </a>
          ) : (
            <span className="profile-info-cards__value">{contact.value}</span>
          )}
        </div>
      ))}

      {/* Hobbies / Interests Card */}
      {hobbies.length > 0 && (
        <div className="profile-info-cards__card">
          <span className="profile-info-cards__label">Interests</span>
          <div className="profile-info-cards__tags">
            {hobbies.map((hobby) => (
              <span key={hobby.id} className="profile-info-cards__tag">
                {hobby.icon && (
                  <span className="profile-info-cards__tag-icon">
                    {hobby.icon}
                  </span>
                )}
                {hobby.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Default hobbies for demo
export const defaultHobbies: HobbyTag[] = [
  { id: "photo", icon: "❤️", name: "Photography" },
  { id: "travel", icon: "❤️", name: "Travel" },
  { id: "cooking", icon: "❤️", name: "Cooking" },
];
