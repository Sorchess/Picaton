import type { CompanyRoleInfo } from "@/entities/company";
import { isOwnerRole } from "@/entities/company";
import { useI18n } from "@/shared/config";
import "./RoleSelect.scss";

interface RoleSelectProps {
  roles: CompanyRoleInfo[];
  selectedRoleId: string;
  onChange: (roleId: string) => void;
  excludeOwner?: boolean;
  disabled?: boolean;
  showDescription?: boolean;
}

// Описания ролей
function getRoleDescription(
  role: CompanyRoleInfo,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const name = role.name.toLowerCase();
  if (name === "owner" || role.priority === 0) {
    return t("roleSelect.ownerDescription");
  }
  if (name === "admin" || role.priority === 1) {
    return t("roleSelect.adminDescription");
  }
  return t("roleSelect.memberDescription");
}

export function RoleSelect({
  roles,
  selectedRoleId,
  onChange,
  excludeOwner = true,
  disabled = false,
  showDescription = true,
}: RoleSelectProps) {
  const { t } = useI18n();
  const filteredRoles = excludeOwner
    ? roles.filter((r) => !isOwnerRole(r))
    : roles;

  const selectedRole = filteredRoles.find((r) => r.id === selectedRoleId);

  return (
    <div className="role-select">
      <div className="role-select__options">
        {filteredRoles.map((role) => (
          <button
            key={role.id}
            type="button"
            className={`role-select__option ${
              selectedRoleId === role.id ? "role-select__option--selected" : ""
            }`}
            onClick={() => onChange(role.id)}
            disabled={disabled}
            style={
              {
                "--role-color": role.color,
                "--role-color-bg": `${role.color}20`,
              } as React.CSSProperties
            }
          >
            <span
              className="role-select__color"
              style={{ backgroundColor: role.color }}
            />
            <div className="role-select__content">
              <span className="role-select__name">{role.name}</span>
              {showDescription && (
                <span className="role-select__desc">
                  {getRoleDescription(role, t)}
                </span>
              )}
            </div>
            {selectedRoleId === role.id && (
              <span className="role-select__check">✓</span>
            )}
          </button>
        ))}
      </div>
      {selectedRole && showDescription && (
        <div
          className="role-select__preview"
          style={{ borderColor: selectedRole.color }}
        >
          <span
            className="role-select__preview-dot"
            style={{ backgroundColor: selectedRole.color }}
          />
          <span>{t("roleSelect.selected", { name: selectedRole.name })}</span>
        </div>
      )}
    </div>
  );
}
