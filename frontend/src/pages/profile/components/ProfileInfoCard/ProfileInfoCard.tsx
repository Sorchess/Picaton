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

interface ContactInfo {
  type: string;
  value: string;
  is_primary?: boolean;
}

interface TagInfo {
  id: string;
  name: string;
}

interface ProfileInfoCardProps {
  bio?: string;
  contacts?: ContactInfo[];
  tags?: TagInfo[];
  phone?: string;
  username?: string;
  onUsernameClick?: () => void;
  birthDate?: string;
  additionalFields?: InfoField[];
  className?: string;
}

export const ProfileInfoCard: FC<ProfileInfoCardProps> = ({
  bio,
  contacts = [],
  tags = [],
  phone,
  username,
  onUsernameClick,
  className = "",
}) => {
  const phoneContact = contacts.find((c) => c.type === "phone");
  const displayPhone = phoneContact?.value || phone;

  const otherContacts = contacts.filter((c) => c.type !== "phone");

  const hasContent =
    bio ||
    username ||
    tags.length > 0 ||
    displayPhone ||
    otherContacts.length > 0;

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

      {/* Skills Card */}
      {tags.length > 0 && (
        <div className="profile-info-cards__card">
          <span className="profile-info-cards__label">Навыки</span>
          <div className="profile-info-cards__tags">
            {tags.map((tag) => (
              <span key={tag.id} className="profile-info-cards__tag">
                <span className="profile-info-cards__tag-icon">
                  <svg
                    width="12"
                    height="11"
                    viewBox="0 0 12 11"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M0 3.65625C0 3.11719 0.0859375 2.625 0.257812 2.17969C0.429688 1.73047 0.669922 1.34375 0.978516 1.01953C1.29102 0.695313 1.6543 0.445312 2.06836 0.269531C2.48242 0.0898437 2.92773 0 3.4043 0C3.96289 0 4.45703 0.119141 4.88672 0.357422C5.31641 0.591797 5.66016 0.902344 5.91797 1.28906C6.18359 0.902344 6.5293 0.591797 6.95508 0.357422C7.38477 0.119141 7.87891 0 8.4375 0C8.91797 0 9.36328 0.0898437 9.77344 0.269531C10.1875 0.445312 10.5488 0.695313 10.8574 1.01953C11.166 1.34375 11.4062 1.73047 11.5781 2.17969C11.7539 2.625 11.8418 3.11719 11.8418 3.65625C11.8418 4.48828 11.6211 5.31445 11.1797 6.13477C10.7383 6.95508 10.1152 7.75195 9.31055 8.52539C8.50977 9.29883 7.5625 10.0371 6.46875 10.7402C6.37891 10.7988 6.2832 10.8516 6.18164 10.8984C6.08398 10.9453 5.99609 10.9688 5.91797 10.9688C5.84766 10.9688 5.76172 10.9453 5.66016 10.8984C5.55859 10.8516 5.46484 10.7988 5.37891 10.7402C4.28516 10.0371 3.33398 9.29883 2.52539 8.52539C1.7207 7.75195 1.09766 6.95508 0.65625 6.13477C0.21875 5.31445 0 4.48828 0 3.65625ZM1.18359 3.65039C1.18359 4.16602 1.30664 4.69141 1.55273 5.22656C1.80273 5.76172 2.14258 6.29102 2.57227 6.81445C3.00195 7.33789 3.49414 7.83984 4.04883 8.32031C4.60742 8.79688 5.19531 9.24023 5.8125 9.65039C5.86719 9.69336 5.90234 9.71484 5.91797 9.71484C5.93359 9.71484 5.97266 9.69336 6.03516 9.65039C6.65234 9.24023 7.23828 8.79688 7.79297 8.32031C8.34766 7.83984 8.83984 7.33789 9.26953 6.81445C9.69922 6.29102 10.0371 5.76172 10.2832 5.22656C10.5332 4.69141 10.6582 4.16602 10.6582 3.65039C10.6582 3.1543 10.5586 2.7207 10.3594 2.34961C10.1602 1.97852 9.88672 1.68945 9.53906 1.48242C9.19531 1.27148 8.80664 1.16602 8.37305 1.16602C8.01758 1.16602 7.71289 1.22852 7.45898 1.35352C7.20898 1.47461 6.99414 1.62891 6.81445 1.81641C6.63477 2 6.47852 2.18359 6.3457 2.36719C6.25977 2.48047 6.18555 2.56055 6.12305 2.60742C6.06445 2.6543 5.99609 2.67773 5.91797 2.67773C5.84375 2.67773 5.77539 2.65625 5.71289 2.61328C5.65039 2.56641 5.57617 2.48438 5.49023 2.36719C5.36914 2.17969 5.21875 1.99414 5.03906 1.81055C4.85938 1.62695 4.64062 1.47461 4.38281 1.35352C4.125 1.22852 3.82031 1.16602 3.46875 1.16602C3.03516 1.16602 2.64453 1.27148 2.29688 1.48242C1.95312 1.68945 1.68164 1.97852 1.48242 2.34961C1.2832 2.7207 1.18359 3.1543 1.18359 3.65039Z"
                      fill="#CD2B2B"
                    />
                  </svg>
                </span>
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
