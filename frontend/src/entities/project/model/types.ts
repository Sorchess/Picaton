// Типы для проектов

export type ProjectStatus =
  | "forming"
  | "active"
  | "paused"
  | "completed"
  | "archived";
export type ProjectMemberRole =
  | "owner"
  | "admin"
  | "member"
  | "pending"
  | "invited";

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectMemberRole;
  position?: string | null;
  skills: string[];
  joined_at: string;
  user_name?: string | null;
  user_avatar_url?: string | null;
}

export interface Project {
  id: string;
  idea_id?: string | null;
  name: string;
  description?: string | null;
  owner_id: string;
  status: ProjectStatus;
  company_id?: string | null;
  avatar_url?: string | null;
  is_public: boolean;
  allow_join_requests: boolean;
  // New fields
  tags: string[];
  required_skills: string[];
  deadline?: string | null; // ISO date string
  problem: string;
  solution: string;
  // Stats
  members_count: number;
  created_at: string;
  updated_at: string;
  is_member: boolean;
  my_role?: ProjectMemberRole | null;
  unread_count: number;
  unread_messages_count: number;
}

export interface ProjectDetail extends Project {
  members: ProjectMember[];
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
}

export interface Invitation {
  id: string;
  project_id: string;
  project_name: string;
  invited_by?: string | null;
  inviter_name?: string | null;
  invited_by_name?: string | null;
  message?: string | null;
  created_at: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  idea_id?: string | null;
  company_id?: string | null;
  is_public?: boolean;
  allow_join_requests?: boolean;
  tags?: string[];
  required_skills?: string[];
  deadline?: string | null; // ISO date string (YYYY-MM-DD)
  problem?: string;
  solution?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  is_public?: boolean;
  allow_join_requests?: boolean;
  tags?: string[];
  required_skills?: string[];
  deadline?: string | null;
  problem?: string;
  solution?: string;
}

export interface InviteMemberRequest {
  user_id: string;
  message?: string;
}

export interface JoinRequestRequest {
  message?: string;
}

// Helper функции
export function getStatusLabel(status: ProjectStatus): string {
  const labels: Record<ProjectStatus, string> = {
    forming: "Формирование",
    active: "Активный",
    paused: "На паузе",
    completed: "Завершён",
    archived: "В архиве",
  };
  return labels[status];
}

export function getRoleLabel(role: ProjectMemberRole): string {
  const labels: Record<ProjectMemberRole, string> = {
    owner: "Владелец",
    admin: "Админ",
    member: "Участник",
    pending: "Ожидает",
    invited: "Приглашён",
  };
  return labels[role];
}

export function canManageMembers(role?: ProjectMemberRole | null): boolean {
  return role === "owner" || role === "admin";
}

export function isActiveMember(role?: ProjectMemberRole | null): boolean {
  return role === "owner" || role === "admin" || role === "member";
}
