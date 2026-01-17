import type { FC, ReactNode } from "react";
import "./PrivacyOption.scss";

export type PrivacyLevel = "public" | "contacts" | "private";

interface PrivacyOptionProps {
  /** Privacy level identifier */
  level: PrivacyLevel;
  /** Option title */
  title: string;
  /** Option description */
  description: string;
  /** Icon or emoji */
  icon: ReactNode;
  /** Selected state */
  isSelected?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Privacy option card for privacy settings (from Figma)
 */
export const PrivacyOption: FC<PrivacyOptionProps> = ({
  level,
  title,
  description,
  icon,
  isSelected = false,
  onClick,
  disabled = false,
  className = "",
}) => {
  return (
    <button
      type="button"
      className={`privacy-option ${isSelected ? "privacy-option--selected" : ""} ${
        disabled ? "privacy-option--disabled" : ""
      } ${className}`}
      onClick={onClick}
      disabled={disabled}
      data-level={level}
    >
      <div className="privacy-option__icon">{icon}</div>
      <div className="privacy-option__content">
        <h4 className="privacy-option__title">{title}</h4>
        <p className="privacy-option__description">{description}</p>
      </div>
      <div className="privacy-option__check">
        {isSelected && (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="10" fill="currentColor" />
            <path
              d="M14 7L8.5 12.5L6 10"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </button>
  );
};

interface PrivacyOptionListProps {
  /** Currently selected privacy level */
  selectedLevel: PrivacyLevel;
  /** Change handler */
  onChange: (level: PrivacyLevel) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * List of privacy options (from Figma)
 */
export const PrivacyOptionList: FC<PrivacyOptionListProps> = ({
  selectedLevel,
  onChange,
  className = "",
}) => {
  const options: Array<{
    level: PrivacyLevel;
    title: string;
    description: string;
    icon: string;
  }> = [
    {
      level: "public",
      title: "Открытый профиль",
      description: "Все могут найти вас и посмотреть профиль",
      icon: "🌐",
    },
    {
      level: "contacts",
      title: "Только контакты",
      description: "Только ваши контакты видят полный профиль",
      icon: "👥",
    },
    {
      level: "private",
      title: "Приватный",
      description: "Профиль скрыт от поиска",
      icon: "🔒",
    },
  ];

  return (
    <div className={`privacy-option-list ${className}`}>
      {options.map((option) => (
        <PrivacyOption
          key={option.level}
          level={option.level}
          title={option.title}
          description={option.description}
          icon={option.icon}
          isSelected={selectedLevel === option.level}
          onClick={() => onChange(option.level)}
        />
      ))}
    </div>
  );
};
