import type { FC } from "react";
import { useI18n } from "@/shared/config";
import "./PrivacyOption.scss";

export type PrivacyLevel = "public" | "contacts" | "private" | "company";

interface PrivacyOptionProps {
  /** Privacy level identifier */
  level: PrivacyLevel;
  /** Option title */
  title: string;
  /** Option description */
  description: string;
  /** Icon or emoji */
  icon?: string;
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
      {icon && <span className="privacy-option__icon">{icon}</span>}
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

export const PrivacyOptionList: FC<PrivacyOptionListProps> = ({
  selectedLevel,
  onChange,
  className = "",
}) => {
  const { t } = useI18n();
  const options: Array<{
    level: PrivacyLevel;
    title: string;
    description: string;
    icon?: string;
  }> = [
    {
      level: "public",
      title: t("privacyOption.all"),
      description: t("privacyOption.allDesc"),
    },
    {
      level: "contacts",
      title: t("privacyOption.contacts"),
      description: t("privacyOption.contactsDesc"),
    },
    {
      level: "private",
      title: t("privacyOption.onlyMe"),
      description: t("privacyOption.onlyMeDesc"),
      icon: "🔒",
    },
    {
      level: "company",
      title: t("privacyOption.company"),
      description: t("privacyOption.companyDesc"),
      icon: "🏢",
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
