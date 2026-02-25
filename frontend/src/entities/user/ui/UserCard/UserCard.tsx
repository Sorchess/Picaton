import type { UserPublic } from "../../model/types";
import { getFullName } from "../../model/types";
import { useTheme } from "@/shared/config/theme";
import "./UserCard.scss";
import { Avatar, Tag } from "@/shared";

interface UserCardProps {
  user: UserPublic;
  /** Показать теги */
  showTags?: boolean;
  /** Максимальное количество отображаемых тегов */
  maxTags?: number;
  /** Клик по карточке */
  onClick?: (user: UserPublic) => void;
  /** Добавление в контакты */
  onAddContact?: (user: UserPublic) => void;
  /** Контакт уже сохранён */
  isSaved?: boolean;
  /** Дополнительные классы */
  className?: string;
  /** Режим компактный */
  compact?: boolean;
}

export function UserCard({
  user,
  showTags = true,
  maxTags = 5,
  onClick,
  onAddContact,
  isSaved = false,
  className = "",
  compact = false,
}: UserCardProps) {
  const { theme } = useTheme();

  const handleClick = () => {
    onClick?.(user);
  };

  const displayedTags = user.search_tags?.slice(0, maxTags) || [];
  const hasMoreTags = (user.search_tags?.length || 0) > maxTags;
  const displayAvatar = user.avatar_url || undefined;
  const fullName = getFullName(user);

  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const classNames = [
    "user-card",
    `user-card--${theme}`,
    compact && "user-card--compact",
    onClick && "user-card--clickable",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={classNames}
      onClick={handleClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="user-card__avatar">
        <Avatar
          initials={getInitials(fullName)}
          src={displayAvatar}
          alt={fullName}
          size="md"
          gradientColors={user.avatar_gradient}
        />
      </div>

      <div className="user-card__content">
        <header className="user-card__header">
          <h3 className="user-card__name">{fullName}</h3>
          {user.position && (
            <span className="user-card__position">{user.position}</span>
          )}
        </header>

        {!compact && user.bio && <p className="user-card__bio">{user.bio}</p>}

        {!compact && user.ai_generated_bio && !user.bio && (
          <p className="user-card__bio user-card__bio--ai">
            <span className="user-card__ai-badge">AI</span>
            {user.ai_generated_bio}
          </p>
        )}

        {showTags && displayedTags.length > 0 && (
          <div className="user-card__tags">
            {displayedTags.map((tag, index) => (
              <Tag key={index} size="sm" variant="default">
                {tag}
              </Tag>
            ))}
            {hasMoreTags && (
              <Tag size="sm" variant="default">
                +{(user.search_tags?.length || 0) - maxTags}
              </Tag>
            )}
          </div>
        )}
      </div>

      <div className="user-card__actions">
        <button
          className={`user-card__action ${
            isSaved ? "user-card__action--saved" : ""
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (!isSaved && onAddContact) {
              onAddContact(user);
            }
          }}
          title={isSaved ? "Сохранено" : "Сохранить контакт"}
          disabled={isSaved}
        >
          {isSaved ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          )}
        </button>
      </div>
    </article>
  );
}
