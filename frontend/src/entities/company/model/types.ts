// Типы для компаний

export type CompanyRole = "owner" | "admin" | "member";
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
  allow_auto_join: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyWithRole {
  company: Company;
  role: CompanyRole;
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
  role: CompanyRole;
  selected_card_id: string | null;
  joined_at: string;
}

export interface CompanyInvitation {
  id: string;
  company_id: string;
  email: string;
  role: CompanyRole;
  invited_by_id: string | null;
  status: InvitationStatus;
  created_at: string;
  expires_at: string | null;
}

export interface InvitationWithCompany {
  id: string;
  company: Company;
  role: CompanyRole;
  invited_by: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
  status: InvitationStatus;
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
  allow_auto_join?: boolean;
}

export interface UpdateCompanyRequest {
  name?: string;
  logo_url?: string;
  description?: string;
  allow_auto_join?: boolean;
}

export interface CreateInvitationRequest {
  email: string;
  role?: CompanyRole;
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

// Role display helpers
export const roleLabels: Record<CompanyRole, string> = {
  owner: "Владелец",
  admin: "Администратор",
  member: "Участник",
};

export const roleColors: Record<CompanyRole, string> = {
  owner: "#f59e0b",
  admin: "#3b82f6",
  member: "#6b7280",
};

export function canManageMembers(role: CompanyRole): boolean {
  return role === "owner" || role === "admin";
}

export function canInvite(role: CompanyRole): boolean {
  return role === "owner" || role === "admin";
}

export function canDeleteCompany(role: CompanyRole): boolean {
  return role === "owner";
}

export function canChangeRoles(role: CompanyRole): boolean {
  return role === "owner";
}
