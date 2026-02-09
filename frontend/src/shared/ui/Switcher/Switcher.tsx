import type { FC, ReactNode } from "react";
import "./Switcher.scss";

export interface SwitcherItem {
  /** Tab identifier */
  id: string;
  /** Tab label */
  label: string;
  /** Tab icon (active) */
  icon: ReactNode;
  /** Tab icon (inactive) */
  iconInactive?: ReactNode;
  /** Navigation path */
  path: string;
  /** Badge count */
  badge?: number;
}

interface SwitcherProps {
  /** Tab items */
  tabs: SwitcherItem[];
  /** Current active path */
  currentPath: string;
  /** Navigation handler */
  onNavigate: (path: string) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Bottom navigation switcher (from Figma)
 */
export const Switcher: FC<SwitcherProps> = ({
  tabs,
  currentPath,
  onNavigate,
  className = "",
}) => {
  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  return (
    <nav className={`switcher ${className}`}>
      <div className="switcher__inner">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <button
              key={tab.id}
              type="button"
              className={`switcher__item ${active ? "switcher__item--active" : ""}`}
              onClick={() => onNavigate(tab.path)}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
            >
              <span className="switcher__icon">
                {active ? tab.icon : tab.iconInactive || tab.icon}
              </span>
              <span className="switcher__label">{tab.label}</span>
              {tab.badge && tab.badge > 0 && (
                <span className="switcher__badge">
                  {tab.badge > 99 ? "99+" : tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

// Default tabs from Figma design
export const defaultTabs: SwitcherItem[] = [
  {
    id: "contacts",
    label: "Контакты",
    path: "/contacts",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M17 20C17 18.3431 14.7614 17 12 17C9.23858 17 7 18.3431 7 20"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="10" r="4" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: "profile",
    label: "Профиль",
    path: "/profile",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
        <path
          d="M6 21C6 17.6863 8.68629 15 12 15C15.3137 15 18 17.6863 18 21"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];
