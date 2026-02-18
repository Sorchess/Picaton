// Типы для компаний

// Новая система ролей - роль как объект
export interface CompanyRoleInfo {
  id: string;
  name: string;
  color: string;
  priority: number;
  is_system: boolean;
}

// Полная информация о роли (для редактирования)
export interface CompanyRoleFull {
  id: string;
  company_id: string;
  name: string;
  color: string;
  priority: number;
  permissions: Permission[];
  is_system: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Права доступа
export type Permission =
  | "manage_company"
  | "delete_company"
  | "view_company_settings"
  | "manage_roles"
  | "assign_roles"
  | "view_roles"
  | "invite_members"
  | "remove_members"
  | "view_members"
  | "manage_invitations"
  | "edit_own_card"
  | "edit_any_card"
  | "view_cards"
  | "delete_any_card"
  | "manage_company_tags"
  | "edit_own_tags"
  | "edit_any_tags"
  | "assign_position"
  | "assign_department"
  | "manage_departments"
  | "manage_positions";

export type PermissionGroup =
  | "company"
  | "roles"
  | "members"
  | "cards"
  | "tags"
  | "organization";

export interface PermissionInfo {
  value: Permission;
  name: string;
  description: string;
  group: PermissionGroup;
}

export interface PermissionGroupInfo {
  value: PermissionGroup;
  name: string;
  permissions: PermissionInfo[];
}

export interface PermissionsListResponse {
  groups: PermissionGroupInfo[];
  all_permissions: PermissionInfo[];
}

export interface RolesListResponse {
  roles: CompanyRoleFull[];
  total: number;
}

export interface CreateRoleRequest {
  name: string;
  color?: string;
  permissions?: Permission[];
  priority?: number;
}

export interface UpdateRoleRequest {
  name?: string;
  color?: string;
  permissions?: Permission[];
}

// Deprecated: старый тип для обратной совместимости
export type LegacyCompanyRole = "owner" | "admin" | "member";

export type InvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled";

export interface Company {
  id: string;
  name: string;
  email_domain: string;
  logo_url: string | null;
  description: string | null;
  owner_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyWithRole {
  company: Company;
  role: CompanyRoleInfo | null;
  joined_at: string;
}

export interface CompanyMember {
  id: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url: string | null;
  };
  role: CompanyRoleInfo | null;
  selected_card_id: string | null;
  joined_at: string;
}

export interface CompanyInvitation {
  id: string;
  company_id: string;
  email: string;
  role: CompanyRoleInfo | null;
  invited_by_id: string | null;
  status: InvitationStatus;
  created_at: string;
  expires_at: string | null;
}

export interface InvitationWithCompany {
  id: string;
  company: Company;
  role: CompanyRoleInfo | null;
  invited_by: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
  status: InvitationStatus;
  token: string;
  created_at: string;
  expires_at: string | null;
}

// Card selection
export interface CompanyCardAssignment {
  company_id: string;
  company_name: string;
  selected_card_id: string | null;
}

export interface SetSelectedCardRequest {
  card_id: string | null;
}

// Request types
export interface CreateCompanyRequest {
  name: string;
  email_domain: string;
  logo_url?: string;
  description?: string;
}

export interface UpdateCompanyRequest {
  name?: string;
  logo_url?: string;
  description?: string;
}

export interface CreateInvitationRequest {
  email: string;
  role_id?: string; // ID роли для приглашения
}

export interface AcceptInvitationRequest {
  token: string;
}

export interface DeclineInvitationRequest {
  token: string;
}

// Response types
export interface MessageResponse {
  message: string;
  success: boolean;
}

// Role helper functions
export function getRoleName(role: CompanyRoleInfo | null): string {
  if (!role) return "Участник";
  return role.name;
}

export function getRoleColor(role: CompanyRoleInfo | null): string {
  if (!role) return "#6b7280";
  return role.color;
}

export function isOwnerRole(role: CompanyRoleInfo | null): boolean {
  if (!role) return false;
  return role.is_system && role.priority === 0;
}

export function isAdminRole(role: CompanyRoleInfo | null): boolean {
  if (!role) return false;
  return role.is_system && role.priority === 1;
}

export function canManageMembers(role: CompanyRoleInfo | null): boolean {
  if (!role) return false;
  return isOwnerRole(role) || isAdminRole(role);
}

export function canInvite(role: CompanyRoleInfo | null): boolean {
  if (!role) return false;
  return isOwnerRole(role) || isAdminRole(role);
}

export function canDeleteCompany(role: CompanyRoleInfo | null): boolean {
  return isOwnerRole(role);
}

export function canChangeRoles(role: CompanyRoleInfo | null): boolean {
  return isOwnerRole(role);
}
