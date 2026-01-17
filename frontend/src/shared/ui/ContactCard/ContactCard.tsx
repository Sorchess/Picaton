import type { FC } from "react";
import "./ContactCard.scss";

interface ContactCardProps {
  /** Contact name */
  name: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Role/position tags */
  roles?: string[];
  /** Company names */
  companies?: string[];
  /** Skills/tags */
  skills?: string[];
  /** Short bio */
  bio?: string;
  /** Is contact saved */
  isSaved?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Save handler */
  onSave?: () => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Contact/Specialist card from Figma search results
 * Shows avatar, name, roles, and skills
 */
export const ContactCard: FC<ContactCardProps> = ({
  name,
  avatarUrl,
  roles = [],
  companies = [],
  skills = [],
  bio,
  isSaved = false,
  onClick,
  onSave,
  className = "",
}) => {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSave?.();
  };

  return (
    <article
      className={`contact-card ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="contact-card__avatar">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="contact-card__avatar-img" />
        ) : (
          <span className="contact-card__avatar-initials">{initials}</span>
        )}
      </div>

      <div className="contact-card__content">
        <h3 className="contact-card__name">{name}</h3>
        
        {roles.length > 0 && (
          <p className="contact-card__roles">{roles.join(" • ")}</p>
        )}
        
        {companies.length > 0 && (
          <p className="contact-card__companies">{companies.join(", ")}</p>
        )}

        {bio && <p className="contact-card__bio">{bio}</p>}

        {skills.length > 0 && (
          <div className="contact-card__skills">
            {skills.slice(0, 4).map((skill, index) => (
              <span key={index} className="contact-card__skill">
                {skill}
              </span>
            ))}
            {skills.length > 4 && (
              <span className="contact-card__skill contact-card__skill--more">
                +{skills.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {onSave && (
        <button
          type="button"
          className={`contact-card__save ${isSaved ? "contact-card__save--saved" : ""}`}
          onClick={handleSaveClick}
          aria-label={isSaved ? "Удалить из контактов" : "Сохранить контакт"}
        >
          {isSaved ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 18l-1.45-1.32C4.4 12.36 2 10.28 2 7.5 2 5.42 3.42 4 5.5 4c1.26 0 2.47.58 3.25 1.49L10 6.85l1.25-1.36C12.03 4.58 13.24 4 14.5 4 16.58 4 18 5.42 18 7.5c0 2.78-2.4 4.86-6.55 9.18L10 18z"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 18l-1.45-1.32C4.4 12.36 2 10.28 2 7.5 2 5.42 3.42 4 5.5 4c1.26 0 2.47.58 3.25 1.49L10 6.85l1.25-1.36C12.03 4.58 13.24 4 14.5 4 16.58 4 18 5.42 18 7.5c0 2.78-2.4 4.86-6.55 9.18L10 18z"/>
            </svg>
          )}
        </button>
      )}
    </article>
  );
};

/**
 * Container for contact cards list
 */
export const ContactCardList: FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => {
  return <div className={`contact-card-list ${className}`}>{children}</div>;
};
