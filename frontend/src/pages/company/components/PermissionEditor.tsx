import { useState } from "react";
import type { PermissionGroupInfo, Permission } from "@/entities/company";
import { Typography } from "@/shared";
import "./PermissionEditor.scss";

interface PermissionEditorProps {
  groups: PermissionGroupInfo[];
  selectedPermissions: Permission[];
  onChange: (permissions: Permission[]) => void;
  disabled?: boolean;
}

// Названия групп на русском
const GROUP_NAMES: Record<string, string> = {
  company: "🏢 Компания",
  roles: "👥 Роли",
  members: "👤 Сотрудники",
  cards: "📇 Карточки",
  tags: "🏷️ Теги",
  organization: "🏛️ Организация",
};

// Права которые скрыты (не реализованы)
const HIDDEN_PERMISSIONS: Permission[] = [
  "edit_any_card",
  "delete_any_card",
  "edit_any_tags",
];

export function PermissionEditor({
  groups,
  selectedPermissions,
  onChange,
  disabled = false,
}: PermissionEditorProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(groups.map((g) => g.value))
  );

  // Фильтруем скрытые права
  const filteredGroups = groups
    .map((group) => ({
      ...group,
      permissions: group.permissions.filter(
        (p) => !HIDDEN_PERMISSIONS.includes(p.value)
      ),
    }))
    .filter((g) => g.permissions.length > 0);

  // Подсчёт выбранных прав
  const totalSelected = selectedPermissions.filter(
    (p) => !HIDDEN_PERMISSIONS.includes(p)
  ).length;
  const totalAvailable = filteredGroups.reduce(
    (sum, g) => sum + g.permissions.length,
    0
  );

  // Toggle группы (развернуть/свернуть)
  const toggleGroupExpand = (groupValue: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupValue)) {
        next.delete(groupValue);
      } else {
        next.add(groupValue);
      }
      return next;
    });
  };

  // Toggle одного права
  const togglePermission = (permission: Permission) => {
    if (disabled) return;

    const newPermissions = selectedPermissions.includes(permission)
      ? selectedPermissions.filter((p) => p !== permission)
      : [...selectedPermissions, permission];

    onChange(newPermissions);
  };

  // Выбрать/снять все права в группе
  const toggleGroupAll = (group: PermissionGroupInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;

    const groupPerms = group.permissions
      .map((p) => p.value)
      .filter((p) => !HIDDEN_PERMISSIONS.includes(p));

    const allSelected = groupPerms.every((p) =>
      selectedPermissions.includes(p)
    );

    let newPermissions: Permission[];
    if (allSelected) {
      // Снять все права группы
      newPermissions = selectedPermissions.filter(
        (p) => !groupPerms.includes(p)
      );
    } else {
      // Добавить все права группы
      const toAdd = groupPerms.filter((p) => !selectedPermissions.includes(p));
      newPermissions = [...selectedPermissions, ...toAdd];
    }

    onChange(newPermissions);
  };

  return (
    <div
      className={`permission-editor ${
        disabled ? "permission-editor--disabled" : ""
      }`}
    >
      <div className="permission-editor__header">
        <Typography variant="h4">Права доступа</Typography>
        <Typography variant="small" color="secondary">
          Выбрано: {totalSelected} из {totalAvailable}
        </Typography>
      </div>

      <div className="permission-editor__groups">
        {filteredGroups.map((group) => {
          const groupPerms = group.permissions.map((p) => p.value);
          const selectedInGroup = groupPerms.filter((p) =>
            selectedPermissions.includes(p)
          ).length;
          const allSelected =
            selectedInGroup === groupPerms.length && groupPerms.length > 0;
          const isExpanded = expandedGroups.has(group.value);

          return (
            <div key={group.value} className="permission-group">
              <div
                className="permission-group__header"
                onClick={() => toggleGroupExpand(group.value)}
              >
                <span
                  className={`permission-group__arrow ${
                    isExpanded ? "permission-group__arrow--expanded" : ""
                  }`}
                >
                  ▶
                </span>
                <span className="permission-group__name">
                  {GROUP_NAMES[group.value] || group.name}
                </span>
                <span className="permission-group__count">
                  {selectedInGroup}/{groupPerms.length}
                </span>
                <button
                  type="button"
                  className={`permission-group__select-all ${
                    allSelected ? "permission-group__select-all--active" : ""
                  }`}
                  onClick={(e) => toggleGroupAll(group, e)}
                  disabled={disabled}
                >
                  {allSelected ? "Снять все" : "Выбрать все"}
                </button>
              </div>

              {isExpanded && (
                <div className="permission-group__list">
                  {group.permissions.map((perm) => {
                    const isSelected = selectedPermissions.includes(perm.value);
                    return (
                      <div
                        key={perm.value}
                        className={`permission-item ${
                          isSelected ? "permission-item--selected" : ""
                        } ${disabled ? "permission-item--disabled" : ""}`}
                        onClick={() => togglePermission(perm.value)}
                      >
                        <div
                          className={`permission-item__checkbox ${
                            isSelected
                              ? "permission-item__checkbox--checked"
                              : ""
                          }`}
                        >
                          {isSelected && "✓"}
                        </div>
                        <div className="permission-item__content">
                          <span className="permission-item__name">
                            {perm.description}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {disabled && (
        <div className="permission-editor__disabled-notice">
          <Typography variant="small" color="secondary">
            Права владельца нельзя изменить
          </Typography>
        </div>
      )}
    </div>
  );
}
