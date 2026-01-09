import { useState, useCallback, useMemo } from "react";
import type { Permission, PermissionGroupInfo } from "@/entities/company";
import "./PermissionEditor.scss";

interface PermissionEditorProps {
  groups: PermissionGroupInfo[];
  selectedPermissions: Permission[];
  onChange: (permissions: Permission[]) => void;
  disabled?: boolean;
}

// Иконки для групп
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
  cards: "Визитки",
  tags: "Теги",
  organization: "Структура",
};

// Описания групп
const GROUP_DESCRIPTIONS: Record<string, string> = {
  company: "Управление настройками компании",
  roles: "Создание и назначение ролей",
  members: "Приглашение и управление сотрудниками",
  cards: "Работа с визитками",
  tags: "Управление тегами и навыками",
  organization: "Должности и отделы",
};

export function PermissionEditor({
  groups,
  selectedPermissions,
  onChange,
  disabled = false,
}: PermissionEditorProps) {
  const [activeGroup, setActiveGroup] = useState<string>(
    groups[0]?.value || ""
  );

  // Текущая активная группа
  const currentGroup = useMemo(
    () => groups.find((g) => g.value === activeGroup) || groups[0],
    [groups, activeGroup]
  );

  // Статистика по группам
  const groupStats = useMemo(() => {
    const stats: Record<string, { selected: number; total: number }> = {};
    groups.forEach((group) => {
      const total = group.permissions.length;
      const selected = group.permissions.filter((p) =>
        selectedPermissions.includes(p.value)
      ).length;
      stats[group.value] = { total, selected };
    });
    return stats;
  }, [groups, selectedPermissions]);

  // Общая статистика
  const totalStats = useMemo(() => {
    const total = groups.reduce((acc, g) => acc + g.permissions.length, 0);
    return { total, selected: selectedPermissions.length };
  }, [groups, selectedPermissions]);

  // Переключение права
  const togglePermission = useCallback(
    (permission: Permission) => {
      if (disabled) return;
      if (selectedPermissions.includes(permission)) {
        onChange(selectedPermissions.filter((p) => p !== permission));
      } else {
        onChange([...selectedPermissions, permission]);
      }
    },
    [disabled, selectedPermissions, onChange]
  );

  // Выбрать все в группе
  const selectAllInGroup = useCallback(() => {
    if (disabled || !currentGroup) return;
    const groupPerms = currentGroup.permissions.map((p) => p.value);
    const newPerms = [...new Set([...selectedPermissions, ...groupPerms])];
    onChange(newPerms);
  }, [disabled, currentGroup, selectedPermissions, onChange]);

  // Снять все в группе
  const deselectAllInGroup = useCallback(() => {
    if (disabled || !currentGroup) return;
    const groupPerms = currentGroup.permissions.map((p) => p.value);
    onChange(selectedPermissions.filter((p) => !groupPerms.includes(p)));
  }, [disabled, currentGroup, selectedPermissions, onChange]);

  // Выбрать все права
  const selectAll = useCallback(() => {
    if (disabled) return;
    const all = groups.flatMap((g) => g.permissions.map((p) => p.value));
    onChange(all);
  }, [disabled, groups, onChange]);

  // Снять все права
  const deselectAll = useCallback(() => {
    if (disabled) return;
    onChange([]);
  }, [disabled, onChange]);

  if (!groups || groups.length === 0) {
    return (
      <div className="perm-editor perm-editor--empty">
        <div className="perm-editor__empty-state">
          <span className="perm-editor__empty-icon">🔐</span>
          <p>Нет доступных прав</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`perm-editor ${disabled ? "perm-editor--disabled" : ""}`}>
      {/* Боковое меню */}
      <div className="perm-editor__sidebar">
        <div className="perm-editor__sidebar-header">
          <div className="perm-editor__sidebar-title">Категории</div>
          <div className="perm-editor__sidebar-stats">
            {totalStats.selected}/{totalStats.total}
          </div>
        </div>

        <div className="perm-editor__sidebar-list">
          {groups.map((group) => {
            const stats = groupStats[group.value];
            const isActive = activeGroup === group.value;
            const isComplete = stats.selected === stats.total;
            const hasSelected = stats.selected > 0;

            return (
              <button
                key={group.value}
                type="button"
                className={`perm-editor__sidebar-item ${
                  isActive ? "perm-editor__sidebar-item--active" : ""
                } ${isComplete ? "perm-editor__sidebar-item--complete" : ""}`}
                onClick={() => setActiveGroup(group.value)}
              >
                <span className="perm-editor__sidebar-icon">
                  {GROUP_ICONS[group.value] || "📋"}
                </span>
                <span className="perm-editor__sidebar-name">
                  {GROUP_NAMES[group.value] || group.name}
                </span>
                <span
                  className={`perm-editor__sidebar-badge ${
                    hasSelected ? "perm-editor__sidebar-badge--has" : ""
                  } ${isComplete ? "perm-editor__sidebar-badge--full" : ""}`}
                >
                  {stats.selected}
                </span>
              </button>
            );
          })}
        </div>

        <div className="perm-editor__sidebar-footer">
          <button
            type="button"
            className="perm-editor__sidebar-btn perm-editor__sidebar-btn--select"
            onClick={selectAll}
            disabled={disabled}
          >
            ✓ Все права
          </button>
          <button
            type="button"
            className="perm-editor__sidebar-btn perm-editor__sidebar-btn--clear"
            onClick={deselectAll}
            disabled={disabled}
          >
            ✕ Сбросить
          </button>
        </div>
      </div>

      {/* Основная область */}
      <div className="perm-editor__main">
        {currentGroup && (
          <>
            {/* Заголовок категории */}
            <div className="perm-editor__header">
              <div className="perm-editor__header-info">
                <div className="perm-editor__header-icon">
                  {GROUP_ICONS[currentGroup.value] || "📋"}
                </div>
                <div className="perm-editor__header-text">
                  <h4 className="perm-editor__header-title">
                    {GROUP_NAMES[currentGroup.value] || currentGroup.name}
                  </h4>
                  <p className="perm-editor__header-desc">
                    {GROUP_DESCRIPTIONS[currentGroup.value] || ""}
                  </p>
                </div>
              </div>
              <div className="perm-editor__header-actions">
                <button
                  type="button"
                  className="perm-editor__header-btn"
                  onClick={selectAllInGroup}
                  disabled={disabled}
                >
                  Выбрать все
                </button>
                <button
                  type="button"
                  className="perm-editor__header-btn"
                  onClick={deselectAllInGroup}
                  disabled={disabled}
                >
                  Снять все
                </button>
              </div>
            </div>

            {/* Список прав */}
            <div className="perm-editor__permissions">
              {currentGroup.permissions.map((perm) => {
                const isChecked = selectedPermissions.includes(perm.value);
                return (
                  <div
                    key={perm.value}
                    className={`perm-card ${
                      isChecked ? "perm-card--checked" : ""
                    }`}
                    onClick={() => togglePermission(perm.value)}
                  >
                    <div className="perm-card__checkbox">
                      <div
                        className={`perm-card__check ${
                          isChecked ? "perm-card__check--on" : ""
                        }`}
                      >
                        {isChecked && (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="perm-card__content">
                      <div className="perm-card__name">{perm.name}</div>
                      <div className="perm-card__desc">{perm.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
