import type { FC, ReactNode } from "react";
import "./Tabs.scss";

export interface Tab {
  /** Unique tab identifier */
  id: string;
  /** Tab label text */
  label: ReactNode;
  /** Optional icon or emoji */
  icon?: ReactNode;
}

interface TabsProps {
  /** Available tabs */
  tabs: Tab[];
  /** Active tab id */
  activeId: string;
  /** Callback when tab changes */
  onChange: (id: string) => void;
  /** Additional CSS class */
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Whether tabs should stretch to fill container */
  fullWidth?: boolean;
}

/**
 * Universal Tabs component for switching between views
 * Used in: RoleTabs, ContactsPage, ShareContactPage
 */
export const Tabs: FC<TabsProps> = ({
  tabs,
  activeId,
  onChange,
  className = "",
  size = "md",
  fullWidth = true,
}) => {
  return (
    <div
      className={`tabs tabs--${size} ${fullWidth ? "tabs--full-width" : ""} ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            className={`tabs__tab ${isActive ? "tabs__tab--active" : ""}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label && <span className="tabs__label">{tab.label}</span>}
            {tab.icon && <span className="tabs__icon">{tab.icon}</span>}
          </button>
        );
      })}
    </div>
  );
};
