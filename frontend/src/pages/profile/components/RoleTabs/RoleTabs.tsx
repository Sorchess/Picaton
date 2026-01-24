import type { FC } from "react";
import { Tabs, type Tab } from "@/shared";

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
 * Uses Tabs component from UI kit
 */
export const RoleTabs: FC<RoleTabsProps> = ({
  roles,
  activeRoleId,
  onChange,
  className = "",
}) => {
  // Преобразуем roles в формат Tab
  const tabs: Tab[] = roles.map((role) => ({
    id: role.id,
    label: role.name,
    icon: role.emoji,
  }));

  return (
    <Tabs
      tabs={tabs}
      activeId={activeRoleId}
      onChange={onChange}
      className={className}
    />
  );
};

// Default roles for demo
export const defaultRoles: RoleTab[] = [
  { id: "personal", name: "Личный", emoji: "🔥" },
  { id: "uiux", name: "UI/UX Lead", emoji: "🌟" },
  { id: "marketing", name: "Маркетолог", emoji: "✨" },
  { id: "travel", name: "Путешественник", emoji: "🧭" },
];
