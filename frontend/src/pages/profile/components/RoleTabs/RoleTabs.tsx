import type { FC } from "react";
import "./RoleTabs.scss";

export interface RoleTab {
  /** Role id */
  id: string;
  /** Role name */
  name: string;
  /** Role emoji */
  emoji: string;
}

interface RoleTabsProps {
  /** Available roles */
  roles: RoleTab[];
  /** Active role id */
  activeRoleId: string;
  /** On role change */
  onChange: (roleId: string) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Role tabs switcher for profile (from Figma design)
 */
export const RoleTabs: FC<RoleTabsProps> = ({
  roles,
  activeRoleId,
  onChange,
  className = "",
}) => {
  return (
    <div className={`role-tabs ${className}`}>
      {roles.map((role) => {
        const isActive = role.id === activeRoleId;
        return (
          <button
            key={role.id}
            type="button"
            className={`role-tabs__tab ${isActive ? "role-tabs__tab--active" : ""}`}
            onClick={() => onChange(role.id)}
          >
            <span className="role-tabs__name">{role.name}</span>
            <span className="role-tabs__emoji">{role.emoji}</span>
          </button>
        );
      })}
    </div>
  );
};

// Default roles for demo
export const defaultRoles: RoleTab[] = [
  { id: "personal", name: "Личный", emoji: "🔥" },
  { id: "uiux", name: "UI/UX Lead", emoji: "🌟" },
  { id: "marketing", name: "Маркетолог", emoji: "✨" },
  { id: "travel", name: "Путешественник", emoji: "🧭" },
];
