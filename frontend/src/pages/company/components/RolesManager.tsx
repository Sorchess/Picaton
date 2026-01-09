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

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<CompanyRoleFull | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [formData, setFormData] = useState<{
    name: string;
    color: string;
    permissions: Permission[];
  }>({
    name: "",
    color: "#808080",
    permissions: [],
  });

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
      setError("Не удалось загрузить роли");
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Открыть модалку создания
  const handleOpenCreate = () => {
    setFormData({
      name: "",
      color: "#6366f1",
      permissions: [
        "view_company_settings",
        "view_roles",
        "view_members",
        "edit_own_card",
        "view_cards",
        "edit_own_tags",
      ],
    });
    setIsCreateModalOpen(true);
  };

  // Открыть модалку редактирования
  const handleOpenEdit = (role: CompanyRoleFull) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      color: role.color,
      permissions: role.permissions,
    });
    setIsEditModalOpen(true);
  };

  // Открыть модалку удаления
  const handleOpenDelete = (role: CompanyRoleFull) => {
    setSelectedRole(role);
    setIsDeleteModalOpen(true);
  };

  // Создать роль
  const handleCreate = async () => {
    if (!formData.name.trim()) return;

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
      onRolesChange?.();
    } catch (err) {
      console.error("Ошибка создания роли:", err);
      setError("Не удалось создать роль");
    } finally {
      setIsSaving(false);
    }
  };

  // Обновить роль
  const handleUpdate = async () => {
    if (!selectedRole || !formData.name.trim()) return;

    setIsSaving(true);
    try {
      const data: UpdateRoleRequest = {
        name: formData.name.trim(),
        color: formData.color,
        permissions: formData.permissions,
      };
      await companyApi.updateRole(companyId, selectedRole.id, data);
      await loadData();
      setIsEditModalOpen(false);
      setSelectedRole(null);
      onRolesChange?.();
    } catch (err) {
      console.error("Ошибка обновления роли:", err);
      setError("Не удалось обновить роль");
    } finally {
      setIsSaving(false);
    }
  };

  // Удалить роль
  const handleDelete = async () => {
    if (!selectedRole) return;

    // Найти роль по умолчанию для переназначения
    const defaultRole = roles.find((r) => r.is_default);

    setIsSaving(true);
    try {
      await companyApi.deleteRole(companyId, selectedRole.id, defaultRole?.id);
      await loadData();
      setIsDeleteModalOpen(false);
      setSelectedRole(null);
      onRolesChange?.();
    } catch (err) {
      console.error("Ошибка удаления роли:", err);
      setError("Не удалось удалить роль");
    } finally {
      setIsSaving(false);
    }
  };

  // Обработчик изменения прав
  const handlePermissionsChange = (permissions: Permission[]) => {
    setFormData((prev) => ({
      ...prev,
      permissions,
    }));
  };

  if (isLoading) {
    return (
      <div className="roles-manager__loading">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="roles-manager__error">
        <Typography variant="body" color="secondary">
          {error}
        </Typography>
        <Button variant="ghost" onClick={loadData}>
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <div className="roles-manager">
      <div className="roles-manager__header">
        <Typography variant="h3">Роли компании</Typography>
        {canManageRoles && (
          <Button size="sm" onClick={handleOpenCreate}>
            + Создать роль
          </Button>
        )}
      </div>

      <div className="roles-manager__list">
        {roles.map((role) => (
          <div
            key={role.id}
            className="role-card"
            style={
              {
                "--role-color": role.color,
                "--role-color-bg": `${role.color}15`,
              } as React.CSSProperties
            }
          >
            <div className="role-card__header">
              <span
                className="role-card__color"
                style={{ backgroundColor: role.color }}
              />
              <div className="role-card__info">
                <Typography variant="body" className="role-card__name">
                  {role.is_system && role.priority === 0 && "👑 "}
                  {role.name}
                </Typography>
                <Typography variant="small" color="secondary">
                  {role.is_system ? "Системная роль" : "Кастомная роль"}
                  {role.is_default && " • По умолчанию"}
                </Typography>
              </div>
              {canManageRoles && !role.is_system && (
                <div className="role-card__actions">
                  <button
                    className="role-card__btn role-card__btn--edit"
                    onClick={() => handleOpenEdit(role)}
                    title="Редактировать"
                  >
                    ✏️
                  </button>
                  <button
                    className="role-card__btn role-card__btn--delete"
                    onClick={() => handleOpenDelete(role)}
                    title="Удалить"
                  >
                    🗑️
                  </button>
                </div>
              )}
              {canManageRoles &&
                role.is_system &&
                !role.is_default &&
                role.priority !== 0 && (
                  <div className="role-card__actions">
                    <button
                      className="role-card__btn role-card__btn--edit"
                      onClick={() => handleOpenEdit(role)}
                      title="Редактировать права"
                    >
                      ✏️
                    </button>
                  </div>
                )}
            </div>
            <div className="role-card__permissions">
              <Typography variant="small" color="secondary">
                {role.permissions.length} прав
              </Typography>
              <div className="role-card__perm-badges">
                {role.permissions.slice(0, 4).map((perm) => (
                  <span key={perm} className="role-card__perm-badge">
                    {getPermissionShortName(perm)}
                  </span>
                ))}
                {role.permissions.length > 4 && (
                  <span className="role-card__perm-badge role-card__perm-badge--more">
                    +{role.permissions.length - 4}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Создать новую роль"
        size="lg"
      >
        <div className="role-form">
          <div className="role-form__row">
            <Input
              label="Название роли"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Например: Менеджер"
            />
            <div className="role-form__color">
              <label>Цвет</label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) =>
                  setFormData({ ...formData, color: e.target.value })
                }
              />
            </div>
          </div>

          <PermissionEditor
            groups={permissionGroups}
            selectedPermissions={formData.permissions}
            onChange={handlePermissionsChange}
          />

          <div className="role-form__actions">
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
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

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Редактировать роль: ${selectedRole?.name || ""}`}
        size="lg"
      >
        <div className="role-form">
          {!selectedRole?.is_system && (
            <div className="role-form__row">
              <Input
                label="Название роли"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Например: Менеджер"
              />
              <div className="role-form__color">
                <label>Цвет</label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          {selectedRole?.is_system && (
            <div className="role-form__notice">
              <Typography variant="small" color="secondary">
                Это системная роль. Вы можете изменить только права доступа.
              </Typography>
            </div>
          )}

          <PermissionEditor
            groups={permissionGroups}
            selectedPermissions={formData.permissions}
            onChange={handlePermissionsChange}
            disabled={selectedRole?.priority === 0} // Owner нельзя редактировать
          />

          <div className="role-form__actions">
            <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isSaving || !formData.name.trim()}
            >
              {isSaving ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Удалить роль"
        size="sm"
      >
        <div className="role-delete-confirm">
          <Typography variant="body">
            Вы уверены, что хотите удалить роль "{selectedRole?.name}"?
          </Typography>
          <Typography variant="small" color="secondary">
            Все участники с этой ролью будут переназначены на роль по умолчанию.
          </Typography>
          <div className="role-form__actions">
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="primary"
              onClick={handleDelete}
              disabled={isSaving}
              className="role-delete-btn"
            >
              {isSaving ? "Удаление..." : "Удалить"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Вспомогательная функция для коротких названий прав
function getPermissionShortName(permission: Permission): string {
  const shortNames: Record<Permission, string> = {
    manage_company: "Компания",
    delete_company: "Удаление",
    view_company_settings: "Просмотр",
    manage_roles: "Роли",
    assign_roles: "Назначение",
    view_roles: "Роли ↓",
    invite_members: "Приглашение",
    remove_members: "Удаление",
    view_members: "Список",
    manage_invitations: "Инвайты",
    edit_own_card: "Своя карточка",
    edit_any_card: "Любая карточка",
    view_cards: "Карточки ↓",
    delete_any_card: "Удаление",
    manage_company_tags: "Теги",
    edit_own_tags: "Свои теги",
    edit_any_tags: "Любые теги",
    assign_position: "Должности",
    assign_department: "Отделы",
    manage_departments: "Отделы",
    manage_positions: "Должности",
  };
  return shortNames[permission] || permission;
}
