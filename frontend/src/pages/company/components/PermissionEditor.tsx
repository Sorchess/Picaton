import { useState, useMemo } from "react";
import type { Permission, PermissionGroupInfo } from "@/entities/company";
import { Typography } from "@/shared";
import "./PermissionEditor.scss";

interface PermissionEditorProps {
  groups: PermissionGroupInfo[];
  selectedPermissions: Permission[];
  onChange: (permissions: Permission[]) => void;
  disabled?: boolean;
}

// Иконки для групп прав
const GROUP_ICONS: Record<string, string> = {
  company: "🏢",
  roles: "👔",
  members: "👥",
  cards: "📇",
  tags: "🏷️",
  organization: "🗂️",
};

// Названия групп
const GROUP_NAMES: Record<string, string> = {
  company: "Компания",
  roles: "Роли",
  members: "Сотрудники",
  cards: "Карточки",
  tags: "Теги",
  organization: "Организация",
};

export function PermissionEditor({
  groups,
  selectedPermissions,
  onChange,
  disabled = false,
}: PermissionEditorProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(groups.map((g) => g.value))
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Фильтрация прав по поисковому запросу
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;

    const query = searchQuery.toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter(
          (perm) =>
            perm.name.toLowerCase().includes(query) ||
            perm.description.toLowerCase().includes(query) ||
            perm.value.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.permissions.length > 0);
  }, [groups, searchQuery]);

  // Подсчёт выбранных прав в группе
  const getGroupStats = (group: PermissionGroupInfo) => {
    const total = group.permissions.length;
    const selected = group.permissions.filter((p) =>
      selectedPermissions.includes(p.value)
    ).length;
    return { total, selected };
  };

  // Проверка, все ли права группы выбраны
  const isGroupFullySelected = (group: PermissionGroupInfo) => {
    const stats = getGroupStats(group);
    return stats.selected === stats.total;
  };

  // Проверка, есть ли хотя бы одно право группы выбрано
  const isGroupPartiallySelected = (group: PermissionGroupInfo) => {
    const stats = getGroupStats(group);
    return stats.selected > 0 && stats.selected < stats.total;
  };

  // Переключение группы (развернуть/свернуть)
  const toggleGroupExpanded = (groupValue: string) => {
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

  // Переключение всех прав группы
  const toggleGroupPermissions = (group: PermissionGroupInfo) => {
    if (disabled) return;

    const groupPermissions = group.permissions.map((p) => p.value);
    const allSelected = isGroupFullySelected(group);

    if (allSelected) {
      // Убрать все права группы
      onChange(
        selectedPermissions.filter((p) => !groupPermissions.includes(p))
      );
    } else {
      // Добавить все права группы
      const newPermissions = new Set([
        ...selectedPermissions,
        ...groupPermissions,
      ]);
      onChange(Array.from(newPermissions));
    }
  };

  // Переключение одного права
  const togglePermission = (permission: Permission) => {
    if (disabled) return;

    if (selectedPermissions.includes(permission)) {
      onChange(selectedPermissions.filter((p) => p !== permission));
    } else {
      onChange([...selectedPermissions, permission]);
    }
  };

  // Выбрать все права
  const selectAll = () => {
    if (disabled) return;
    const allPermissions = groups.flatMap((g) =>
      g.permissions.map((p) => p.value)
    );
    onChange(allPermissions);
  };

  // Снять выбор со всех
  const deselectAll = () => {
    if (disabled) return;
    onChange([]);
  };

  return (
    <div
      className={`permission-editor ${
        disabled ? "permission-editor--disabled" : ""
      }`}
    >
      <div className="permission-editor__header">
        <Typography variant="body" className="permission-editor__title">
          Права доступа ({selectedPermissions.length})
        </Typography>
        <div className="permission-editor__actions">
          <button
            type="button"
            className="permission-editor__action-btn"
            onClick={selectAll}
            disabled={disabled}
          >
            Выбрать все
          </button>
          <button
            type="button"
            className="permission-editor__action-btn"
            onClick={deselectAll}
            disabled={disabled}
          >
            Снять выбор
          </button>
        </div>
      </div>

      <div className="permission-editor__search">
        <input
          type="text"
          placeholder="Поиск прав..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="permission-editor__search-input"
        />
        {searchQuery && (
          <button
            type="button"
            className="permission-editor__search-clear"
            onClick={() => setSearchQuery("")}
          >
            ✕
          </button>
        )}
      </div>

      <div className="permission-editor__groups">
        {filteredGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.value);
          const stats = getGroupStats(group);
          const isFullySelected = isGroupFullySelected(group);
          const isPartiallySelected = isGroupPartiallySelected(group);

          return (
            <div key={group.value} className="permission-group">
              <div
                className={`permission-group__header ${
                  isExpanded ? "permission-group__header--expanded" : ""
                }`}
              >
                <button
                  type="button"
                  className="permission-group__toggle"
                  onClick={() => toggleGroupExpanded(group.value)}
                >
                  <span className="permission-group__arrow">
                    {isExpanded ? "▼" : "▶"}
                  </span>
                  <span className="permission-group__icon">
                    {GROUP_ICONS[group.value] || "📋"}
                  </span>
                  <span className="permission-group__name">
                    {GROUP_NAMES[group.value] || group.name}
                  </span>
                  <span className="permission-group__count">
                    {stats.selected}/{stats.total}
                  </span>
                </button>
                <label
                  className={`permission-checkbox ${
                    isFullySelected ? "permission-checkbox--checked" : ""
                  } ${
                    isPartiallySelected ? "permission-checkbox--partial" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isFullySelected}
                    onChange={() => toggleGroupPermissions(group)}
                    disabled={disabled}
                  />
                  <span className="permission-checkbox__box">
                    {isFullySelected && "✓"}
                    {isPartiallySelected && "−"}
                  </span>
                </label>
              </div>

              {isExpanded && (
                <div className="permission-group__permissions">
                  {group.permissions.map((perm) => {
                    const isSelected = selectedPermissions.includes(perm.value);
                    return (
                      <label
                        key={perm.value}
                        className={`permission-item ${
                          isSelected ? "permission-item--selected" : ""
                        }`}
                      >
                        <div
                          className={`permission-checkbox ${
                            isSelected ? "permission-checkbox--checked" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => togglePermission(perm.value)}
                            disabled={disabled}
                          />
                          <span className="permission-checkbox__box">
                            {isSelected && "✓"}
                          </span>
                        </div>
                        <div className="permission-item__content">
                          <span className="permission-item__name">
                            {perm.name}
                          </span>
                          <span className="permission-item__description">
                            {perm.description}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredGroups.length === 0 && searchQuery && (
        <div className="permission-editor__empty">
          <Typography variant="body" color="secondary">
            Права не найдены
          </Typography>
        </div>
      )}
    </div>
  );
}
