import type { FC, ReactNode } from "react";
import "./SocialTrustCard.scss";

interface TrustItem {
  /** Item id */
  id: string;
  /** Item icon (component or emoji) */
  icon: ReactNode;
  /** Item title */
  title: string;
  /** Item subtitle/description */
  subtitle: string;
  /** Background color variant */
  variant: "blue" | "purple" | "green" | "orange";
  /** On item click */
  onClick?: () => void;
}

interface SocialTrustCardProps {
  /** Card title */
  title?: string;
  /** Trust items */
  items: TrustItem[];
  /** Additional CSS class */
  className?: string;
}

// Icons for trust items
const CheckIcon = () => (
  <svg width="21" height="21" viewBox="0 0 21 21" fill="none">
    <path
      d="M17.5 5.25L8.25 14.5L3.5 9.75"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const UsersIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path
      d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
    <path
      d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M5.25 10.5L8.75 7L5.25 3.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Social Trust card for profile (from Figma design)
 */
export const SocialTrustCard: FC<SocialTrustCardProps> = ({
  title = "Social Trust",
  items,
  className = "",
}) => {
  return (
    <div className={`social-trust-card ${className}`}>
      <h3 className="social-trust-card__title">{title}</h3>

      <div className="social-trust-card__items">
        {items.map((item) => (
          <div
            key={item.id}
            className={`social-trust-card__item social-trust-card__item--${item.variant}`}
            onClick={item.onClick}
            role={item.onClick ? "button" : undefined}
            tabIndex={item.onClick ? 0 : undefined}
          >
            <div
              className={`social-trust-card__item-icon social-trust-card__item-icon--${item.variant}`}
            >
              {item.icon}
            </div>

            <div className="social-trust-card__item-content">
              <span className="social-trust-card__item-title">
                {item.title}
              </span>
              <span className="social-trust-card__item-subtitle">
                {item.subtitle}
              </span>
            </div>

            {item.onClick && (
              <span className="social-trust-card__item-chevron">
                <ChevronRightIcon />
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Default trust items for demo
export const defaultTrustItems: TrustItem[] = [
  {
    id: "skills",
    icon: <CheckIcon />,
    title: "Подтвержденные скиллы",
    subtitle: "142 подтверждения",
    variant: "blue",
  },
  {
    id: "contacts",
    icon: <UsersIcon />,
    title: "Совместных контактов",
    subtitle: "83 контакта",
    variant: "purple",
  },
];

export { CheckIcon, UsersIcon, ChevronRightIcon };
