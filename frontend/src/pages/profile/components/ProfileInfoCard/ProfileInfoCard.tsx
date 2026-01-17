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

interface ProfileInfoCardProps {
  /** Phone number */
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
 * Profile info card with personal data (from Figma design)
 */
export const ProfileInfoCard: FC<ProfileInfoCardProps> = ({
  phone,
  username,
  onUsernameClick,
  birthDate,
  hobbies = [],
  additionalFields = [],
  className = "",
}) => {
  return (
    <div className={`profile-info-card ${className}`}>
      {/* Phone */}
      {phone && (
        <>
          <div className="profile-info-card__field">
            <span className="profile-info-card__label">Мобильный</span>
            <span className="profile-info-card__value">{phone}</span>
          </div>
          <div className="profile-info-card__divider" />
        </>
      )}

      {/* Username */}
      {username && (
        <>
          <div
            className="profile-info-card__field profile-info-card__field--clickable"
            onClick={onUsernameClick}
          >
            <div className="profile-info-card__field-content">
              <span className="profile-info-card__label">Имя пользователя</span>
              <span className="profile-info-card__value">@{username}</span>
            </div>
            <span className="profile-info-card__icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect
                  x="3"
                  y="3"
                  width="7"
                  height="7"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <rect
                  x="14"
                  y="3"
                  width="7"
                  height="7"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <rect
                  x="3"
                  y="14"
                  width="7"
                  height="7"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <rect
                  x="14"
                  y="14"
                  width="7"
                  height="7"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </span>
          </div>
          <div className="profile-info-card__divider" />
        </>
      )}

      {/* Birth date */}
      {birthDate && (
        <>
          <div className="profile-info-card__field">
            <span className="profile-info-card__label">Дата рождения</span>
            <span className="profile-info-card__value">{birthDate}</span>
          </div>
          <div className="profile-info-card__divider" />
        </>
      )}

      {/* Additional fields */}
      {additionalFields.map((field, index) => (
        <div key={index}>
          <div
            className={`profile-info-card__field ${field.onClick ? "profile-info-card__field--clickable" : ""}`}
            onClick={field.onClick}
          >
            <div className="profile-info-card__field-content">
              <span className="profile-info-card__label">{field.label}</span>
              <span className="profile-info-card__value">{field.value}</span>
            </div>
            {field.rightIcon && (
              <span className="profile-info-card__icon">{field.rightIcon}</span>
            )}
          </div>
          {index < additionalFields.length - 1 && (
            <div className="profile-info-card__divider" />
          )}
        </div>
      ))}

      {/* Hobbies */}
      {hobbies.length > 0 && (
        <div className="profile-info-card__hobbies">
          <span className="profile-info-card__label profile-info-card__label--padded">
            Hobbies
          </span>
          <div className="profile-info-card__hobby-tags">
            {hobbies.map((hobby) => (
              <div key={hobby.id} className="profile-info-card__hobby-tag">
                <span className="profile-info-card__hobby-icon">
                  {hobby.icon}
                </span>
                <span className="profile-info-card__hobby-name">
                  {hobby.name}
                </span>
              </div>
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
