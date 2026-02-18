import type { FC, ReactNode } from "react";
import { IconButton } from "@/shared";
import "./ProfileTopBar.scss";

export interface ContactAvatarData {
  avatarUrl: string | null;
  initials: string;
}

interface ProfileTopBarProps {
  /** Left button icon/content */
  leftIcon?: ReactNode;
  /** On left button click */
  onLeftClick?: () => void;
  /** Left button aria-label */
  leftLabel?: string;
  /** Right button icon/content */
  rightIcon?: ReactNode;
  /** On right button click */
  onRightClick?: () => void;
  /** Right button aria-label */
  rightLabel?: string;
  /** Total saved contacts count */
  contactsCount?: number;
  /** Avatar data of saved contacts (first few) */
  contactAvatars?: ContactAvatarData[];
  /** On contacts badge click */
  onContactsClick?: () => void;
  /** Additional CSS class */
  className?: string;
}

// Settings icon
const EditorIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  >
    <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
  </svg>
);

// Share icon
const ShareIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path
      d="M3.33334 10V16.6667C3.33334 17.1087 3.50894 17.5326 3.8215 17.8452C4.13406 18.1577 4.55798 18.3333 5.00001 18.3333H15C15.442 18.3333 15.866 18.1577 16.1785 17.8452C16.4911 17.5326 16.6667 17.1087 16.6667 16.6667V10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.3333 5L10 1.66667L6.66666 5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10 1.66667V12.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Bell icon for notifications
const BellIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

/**
 * Profile top bar with action buttons (from Figma design)
 */
const MAX_AVATARS = 3;

export const ProfileTopBar: FC<ProfileTopBarProps> = ({
  leftIcon = <EditorIcon />,
  onLeftClick,
  leftLabel = "Настройки",
  rightIcon = <BellIcon />,
  onRightClick,
  rightLabel = "Уведомления",
  contactsCount,
  contactAvatars = [],
  onContactsClick,
  className = "",
}) => {
  const visibleAvatars = contactAvatars.slice(0, MAX_AVATARS);
  const extraCount =
    contactAvatars.length > MAX_AVATARS
      ? contactAvatars.length - MAX_AVATARS
      : 0;

  return (
    <div className={`profile-top-bar ${className}`}>
      <IconButton onClick={onLeftClick} aria-label={leftLabel}>
        {leftIcon}
      </IconButton>

      {contactsCount !== undefined && (
        <button
          type="button"
          className="profile-top-bar__contacts-badge"
          onClick={onContactsClick}
        >
          <span className="profile-top-bar__contacts-text">
            {contactsCount} контактов
          </span>
          {visibleAvatars.length > 0 && (
            <div className="profile-top-bar__avatars">
              {visibleAvatars.map((contact, i) =>
                contact.avatarUrl ? (
                  <img
                    key={i}
                    src={contact.avatarUrl}
                    alt=""
                    className="profile-top-bar__avatar"
                  />
                ) : (
                  <div
                    key={i}
                    className="profile-top-bar__avatar profile-top-bar__avatar--placeholder"
                  >
                    <span>{contact.initials}</span>
                  </div>
                ),
              )}
            </div>
          )}
          {extraCount > 0 && (
            <span className="profile-top-bar__contacts-extra">
              +{extraCount}
            </span>
          )}
        </button>
      )}

      <IconButton onClick={onRightClick} aria-label={rightLabel}>
        {rightIcon}
      </IconButton>
    </div>
  );
};

export { EditorIcon, ShareIcon, BellIcon };
