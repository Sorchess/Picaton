import { useState, useEffect, useCallback } from "react";
import type {
  CompanyRoleFull,
  PermissionGroupInfo,
  Permission,
  CreateRoleRequest,
  UpdateRoleRequest,
} from "@/entities/company";
import { companyApi } from "@/entities/company";
import { Typography, Button, Modal, Input, Loader } from "@/shared";
import { PermissionEditor } from "./PermissionEditor";
import "./RolesManager.scss";

interface RolesManagerProps {
  companyId: string;
  canManageRoles: boolean;
  onRolesChange?: () => void;
}

// Предустановленные цвета для выбора
const PRESET_COLORS = [
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#14b8a6", // Teal
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#64748b", // Slate
  "#78716c", // Stone
];

// Права по умолчанию для новой роли
const DEFAULT_PERMISSIONS: Permission[] = [
  "view_company_settings",
  "view_roles",
  "view_members",
  "edit_own_card",
  "view_cards",
  "edit_own_tags",
];

export function RolesManager({
  companyId,
  canManageRoles,
  onRolesChange,
}: RolesManagerProps) {
  const [roles, setRoles] = useState<CompanyRoleFull[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<
    PermissionGroupInfo[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Состояния модалок
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<CompanyRoleFull | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  // Состояние формы
  const [formData, setFormData] = useState<{
    name: string;
    color: string;
    permissions: Permission[];
  }>({
    name: "",
    color: "#6366f1",
    permissions: [],
  });

  // Состояние валидации
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    permissions?: string;
  }>({});

  // Toast уведомления
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Загрузка данных
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rolesData, permissionsData] = await Promise.all([
        companyApi.getRoles(companyId),
        companyApi.getPermissions(),
      ]);
      setRoles(rolesData.roles);
      setPermissionGroups(permissionsData.groups);
    } catch (err) {
      console.error("Ошибка загрузки ролей:", err);
      setError("Не удалось загрузить роли. Попробуйте обновить страницу.");
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Автоскрытие toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
  };

  // Валидация формы
  const validateForm = (): boolean => {
    const errors: typeof formErrors = {};

    if (!formData.name.trim()) {
      errors.name = "Введите название роли";
    } else if (formData.name.trim().length < 2) {
      errors.name = "Название должно быть не менее 2 символов";
    } else if (formData.name.trim().length > 50) {
      errors.name = "Название должно быть не более 50 символов";
    }

    // Проверка уникальности имени (кроме текущей роли при редактировании)
    const existingRole = roles.find(
      (r) =>
        r.name.toLowerCase() === formData.name.trim().toLowerCase() &&
        r.id !== selectedRole?.id,
    );
    if (existingRole) {
      errors.name = "Роль с таким названием уже существует";
    }

    if (formData.permissions.length === 0) {
      errors.permissions = "Выберите хотя бы одно право";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Открытие модалки создания
  const handleOpenCreate = () => {
    setFormData({
      name: "",
      color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)],
      permissions: [...DEFAULT_PERMISSIONS],
    });
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  // Открытие модалки редактирования
  const handleOpenEdit = (role: CompanyRoleFull) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      color: role.color,
      permissions: [...role.permissions],
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  // Открытие модалки удаления
  const handleOpenDelete = (role: CompanyRoleFull) => {
    setSelectedRole(role);
    setIsDeleteModalOpen(true);
  };

  // Создание роли
  const handleCreate = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const data: CreateRoleRequest = {
        name: formData.name.trim(),
        color: formData.color,
        permissions: formData.permissions,
      };
      await companyApi.createRole(companyId, data);
      await loadData();
      setIsCreateModalOpen(false);
      showToast(`Роль "${data.name}" успешно создана`, "success");
      onRolesChange?.();
    } catch (err) {
      console.error("Ошибка создания роли:", err);
      const errorMessage = parseApiError(err) || "Не удалось создать роль";
      showToast(errorMessage, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Обновление роли
  const handleUpdate = async () => {
    if (!selectedRole) return;
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const data: UpdateRoleRequest = {};

      // Для системных ролей можно менять только права
      if (!selectedRole.is_system) {
        data.name = formData.name.trim();
        data.color = formData.color;
      }

      // Права владельца не меняем
      if (selectedRole.priority !== 0) {
        data.permissions = formData.permissions;
      }

      await companyApi.updateRole(companyId, selectedRole.id, data);
      await loadData();
      setIsEditModalOpen(false);
      setSelectedRole(null);
      showToast("Роль успешно обновлена", "success");
      onRolesChange?.();
    } catch (err) {
      console.error("Ошибка обновления роли:", err);
      const errorMessage = parseApiError(err) || "Не удалось обновить роль";
      showToast(errorMessage, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Удаление роли
  const handleDelete = async () => {
    if (!selectedRole) return;

    const defaultRole = roles.find((r) => r.is_default);

    setIsSaving(true);
    try {
      await companyApi.deleteRole(companyId, selectedRole.id, defaultRole?.id);
      await loadData();
      setIsDeleteModalOpen(false);
      showToast(`Роль "${selectedRole.name}" удалена`, "success");
      setSelectedRole(null);
      onRolesChange?.();
    } catch (err) {
      console.error("Ошибка удаления роли:", err);
      const errorMessage = parseApiError(err) || "Не удалось удалить роль";
      showToast(errorMessage, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Обработчик изменения прав
  const handlePermissionsChange = (permissions: Permission[]) => {
    setFormData((prev) => ({ ...prev, permissions }));
    if (formErrors.permissions) {
      setFormErrors((prev) => ({ ...prev, permissions: undefined }));
    }
  };

  // Закрытие модалок
  const handleCloseCreate = () => {
    setIsCreateModalOpen(false);
    setFormErrors({});
  };

  const handleCloseEdit = () => {
    setIsEditModalOpen(false);
    setSelectedRole(null);
    setFormErrors({});
  };

  const handleCloseDelete = () => {
    setIsDeleteModalOpen(false);
    setSelectedRole(null);
  };

  // Получение описания роли
  const getRoleDescription = (role: CompanyRoleFull): string => {
    if (role.priority === 0) return "Полный доступ ко всем функциям";
    if (role.is_system && role.name.toLowerCase() === "admin")
      return "Администратор компании";
    if (role.is_default) return "Назначается новым сотрудникам";
    return `${role.permissions.length} прав доступа`;
  };

  // Получение бейджа роли
  const getRoleBadge = (role: CompanyRoleFull): string | null => {
    if (role.priority === 0) return "👑 Владелец";
    if (role.is_system) return "⚙️ Системная";
    if (role.is_default) return "✨ По умолчанию";
    return null;
  };

  if (isLoading) {
    return (
      <div className="roles-manager__loading">
        <Loader />
        <Typography variant="body" color="secondary">
          Загрузка ролей...
        </Typography>
      </div>
    );
  }

  if (error) {
    return (
      <div className="roles-manager__error">
        <div className="roles-manager__error-icon">⚠️</div>
        <Typography variant="body" color="secondary">
          {error}
        </Typography>
        <Button variant="ghost" onClick={loadData}>
          Попробовать снова
        </Button>
      </div>
    );
  }

  return (
    <div className="roles-manager">
      {/* Заголовок */}
      <div className="roles-manager__header">
        <div className="roles-manager__header-content">
          <Typography variant="h3">Роли компании</Typography>
          <Typography variant="small" color="secondary">
            {roles.length} {getRolesWord(roles.length)}
          </Typography>
        </div>
        {canManageRoles && (
          <Button
            onClick={handleOpenCreate}
            className="roles-manager__create-btn"
          >
            <span className="roles-manager__create-icon">+</span>
            Создать роль
          </Button>
        )}
      </div>

      {/* Список ролей */}
      <div className="roles-manager__list">
        {roles.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            badge={getRoleBadge(role)}
            description={getRoleDescription(role)}
            canEdit={
              canManageRoles && (role.priority !== 0 || !role.is_default)
            }
            canDelete={canManageRoles && !role.is_system}
            onEdit={() => handleOpenEdit(role)}
            onDelete={() => handleOpenDelete(role)}
          />
        ))}
      </div>

      {/* Toast уведомления */}
      {toast && (
        <div className={`roles-toast roles-toast--${toast.type}`}>
          <span className="roles-toast__icon">
            {toast.type === "success" ? "✓" : "✕"}
          </span>
          {toast.message}
        </div>
      )}

      {/* Модалка создания */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreate}
        title="Создать новую роль"
      >
        <div className="role-form">
          <div className="role-form__section">
            <div className="role-form__row">
              <div className="role-form__field">
                <Input
                  label="Название роли"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) {
                      setFormErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                  placeholder="Например: Менеджер проектов"
                  error={formErrors.name}
                />
              </div>
              <div className="role-form__color-picker">
                <label className="role-form__label">Цвет</label>
                <div className="role-form__color-options">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`role-form__color-option ${
                        formData.color === color
                          ? "role-form__color-option--selected"
                          : ""
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, color })}
                      title={color}
                    />
                  ))}
                  <div className="role-form__color-custom">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="role-form__section">
            <PermissionEditor
              groups={permissionGroups}
              selectedPermissions={formData.permissions}
              onChange={handlePermissionsChange}
            />
            {formErrors.permissions && (
              <div className="role-form__error">{formErrors.permissions}</div>
            )}
          </div>

          <div className="role-form__actions">
            <Button variant="ghost" onClick={handleCloseCreate}>
              Отмена
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSaving || !formData.name.trim()}
            >
              {isSaving ? "Создание..." : "Создать роль"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Модалка редактирования */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={handleCloseEdit}
        title={`Редактировать роль${
          selectedRole ? `: ${selectedRole.name}` : ""
        }`}
      >
        <div className="role-form">
          {/* Предупреждение для системных ролей */}
          {selectedRole?.is_system && (
            <div className="role-form__notice role-form__notice--warning">
              <span className="role-form__notice-icon">⚠️</span>
              <div>
                <strong>Системная роль</strong>
                <p>
                  Название и цвет нельзя изменить. Можно редактировать только
                  права доступа.
                </p>
              </div>
            </div>
          )}

          {/* Предупреждение для владельца */}
          {selectedRole?.priority === 0 && (
            <div className="role-form__notice role-form__notice--info">
              <span className="role-form__notice-icon">👑</span>
              <div>
                <strong>Роль владельца</strong>
                <p>
                  Владелец имеет полный доступ ко всем функциям. Права нельзя
                  изменить.
                </p>
              </div>
            </div>
          )}

          {/* Название и цвет (только для кастомных ролей) */}
          {!selectedRole?.is_system && (
            <div className="role-form__section">
              <div className="role-form__row">
                <div className="role-form__field">
                  <Input
                    label="Название роли"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (formErrors.name) {
                        setFormErrors((prev) => ({ ...prev, name: undefined }));
                      }
                    }}
                    placeholder="Например: Менеджер проектов"
                    error={formErrors.name}
                  />
                </div>
                <div className="role-form__color-picker">
                  <label className="role-form__label">Цвет</label>
                  <div className="role-form__color-options">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`role-form__color-option ${
                          formData.color === color
                            ? "role-form__color-option--selected"
                            : ""
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, color })}
                        title={color}
                      />
                    ))}
                    <div className="role-form__color-custom">
                      <input
                        type="color"
                        value={formData.color}
                        onChange={(e) =>
                          setFormData({ ...formData, color: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Редактор прав (не для владельца) */}
          {selectedRole?.priority !== 0 && (
            <div className="role-form__section">
              <PermissionEditor
                groups={permissionGroups}
                selectedPermissions={formData.permissions}
                onChange={handlePermissionsChange}
              />
              {formErrors.permissions && (
                <div className="role-form__error">{formErrors.permissions}</div>
              )}
            </div>
          )}

          <div className="role-form__actions">
            <Button variant="ghost" onClick={handleCloseEdit}>
              Отмена
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving ? "Сохранение..." : "Сохранить изменения"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Модалка удаления */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDelete}
        title="Удалить роль"
      >
        <div className="role-delete">
          <div className="role-delete__icon">🗑️</div>
          <Typography variant="body">
            Вы уверены, что хотите удалить роль{" "}
            <strong>"{selectedRole?.name}"</strong>?
          </Typography>
          <div className="role-delete__warning">
            <span className="role-delete__warning-icon">ℹ️</span>
            <Typography variant="small" color="secondary">
              Все участники с этой ролью будут автоматически переназначены на
              роль по умолчанию.
            </Typography>
          </div>
          <div className="role-form__actions">
            <Button variant="ghost" onClick={handleCloseDelete}>
              Отмена
            </Button>
            <Button
              variant="primary"
              onClick={handleDelete}
              disabled={isSaving}
              className="role-delete__btn"
            >
              {isSaving ? "Удаление..." : "Удалить роль"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Компонент карточки роли
interface RoleCardProps {
  role: CompanyRoleFull;
  badge: string | null;
  description: string;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function RoleCard({
  role,
  badge,
  description,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: RoleCardProps) {
  return (
    <div
      className="role-card"
      style={
        {
          "--role-color": role.color,
          "--role-color-light": `${role.color}20`,
        } as React.CSSProperties
      }
    >
      <div className="role-card__main">
        <div
          className="role-card__color"
          style={{ backgroundColor: role.color }}
        />
        <div className="role-card__info">
          <div className="role-card__name-row">
            <Typography variant="body" className="role-card__name">
              {role.name}
            </Typography>
            {badge && <span className="role-card__badge">{badge}</span>}
          </div>
          <Typography
            variant="small"
            color="secondary"
            className="role-card__description"
          >
            {description}
          </Typography>
        </div>
        {(canEdit || canDelete) && (
          <div className="role-card__actions">
            {canEdit && (
              <button
                className="role-card__btn role-card__btn--edit"
                onClick={onEdit}
                title="Редактировать"
              >
                ✏️
              </button>
            )}
            {canDelete && (
              <button
                className="role-card__btn role-card__btn--delete"
                onClick={onDelete}
                title="Удалить"
              >
                🗑️
              </button>
            )}
          </div>
        )}
      </div>
      <div className="role-card__permissions">
        <div className="role-card__perm-badges">
          {role.permissions.slice(0, 5).map((perm) => (
            <span key={perm} className="role-card__perm-badge">
              {getPermissionLabel(perm)}
            </span>
          ))}
          {role.permissions.length > 5 && (
            <span className="role-card__perm-badge role-card__perm-badge--more">
              +{role.permissions.length - 5}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Вспомогательные функции
function getRolesWord(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return "ролей";
  }

  if (lastDigit === 1) return "роль";
  if (lastDigit >= 2 && lastDigit <= 4) return "роли";
  return "ролей";
}

function getPermissionLabel(permission: Permission): string {
  const labels: Record<Permission, string> = {
    manage_company: "Компания",
    delete_company: "Удаление",
    view_company_settings: "Настройки",
    manage_roles: "Роли",
    assign_roles: "Назначение",
    view_roles: "Просмотр ролей",
    invite_members: "Приглашения",
    remove_members: "Удаление",
    view_members: "Сотрудники",
    manage_invitations: "Инвайты",
    edit_own_card: "Своя карточка",
    edit_any_card: "Карточки",
    view_cards: "Просмотр",
    delete_any_card: "Удаление",
    manage_company_tags: "Теги",
    edit_own_tags: "Свои теги",
    edit_any_tags: "Все теги",
    assign_position: "Должности",
    assign_department: "Отделы",
    manage_departments: "Отделы",
    manage_positions: "Должности",
  };
  return labels[permission] || permission;
}

function parseApiError(err: unknown): string | null {
  const error = err as {
    data?: { detail?: string | Array<{ msg?: string }> };
    message?: string;
  };

  if (typeof error.data?.detail === "string") {
    return error.data.detail;
  }

  if (Array.isArray(error.data?.detail)) {
    return error.data.detail.map((item) => item.msg).join(". ");
  }

  return error.message || null;
}
