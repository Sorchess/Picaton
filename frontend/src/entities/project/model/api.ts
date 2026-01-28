import { api } from "@/shared/api";
import type {
  Project,
  ProjectDetail,
  ProjectListResponse,
  ProjectMember,
  Invitation,
  CreateProjectRequest,
  UpdateProjectRequest,
  InviteMemberRequest,
  JoinRequestRequest,
} from "./types";

export const projectApi = {
  // CRUD
  create: (data: CreateProjectRequest) => api.post<Project>("/projects", data),

  createFromIdea: (ideaId: string) =>
    api.post<Project>(`/projects/from-idea/${ideaId}`),

  get: (projectId: string) => api.get<ProjectDetail>(`/projects/${projectId}`),

  getById: (projectId: string) =>
    api.get<ProjectDetail>(`/projects/${projectId}`),

  update: (projectId: string, data: UpdateProjectRequest) =>
    api.put<Project>(`/projects/${projectId}`, data),

  delete: (projectId: string) => api.delete(`/projects/${projectId}`),

  // Мои проекты
  getMyProjects: (includePending = false, limit = 50, offset = 0) => {
    const params = new URLSearchParams();
    params.append("include_pending", includePending.toString());
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    return api.get<ProjectListResponse>(`/projects/my?${params.toString()}`);
  },

  // Публичные проекты (для витрины)
  getPublicProjects: (limit = 50, offset = 0) => {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    return api.get<ProjectListResponse>(`/projects/public?${params.toString()}`);
  },

  // Приглашения
  getMyInvitations: () => api.get<Invitation[]>("/projects/invitations"),

  // Ответ на приглашение
  respondToInvitation: (invitationId: string, accept: boolean) =>
    api.post(
      `/projects/invitations/${invitationId}/${accept ? "accept" : "decline"}`
    ),

  // Получить участников проекта
  getMembers: (projectId: string) =>
    api.get<{ members: ProjectMember[] }>(`/projects/${projectId}/members`),

  // Управление участниками
  inviteMember: (projectId: string, data: InviteMemberRequest) =>
    api.post<ProjectMember>(`/projects/${projectId}/invite`, data),

  requestToJoin: (projectId: string, data?: JoinRequestRequest) =>
    api.post<ProjectMember>(`/projects/${projectId}/join`, data || {}),

  acceptInvitation: (projectId: string) =>
    api.post<ProjectMember>(`/projects/${projectId}/accept-invitation`),

  declineInvitation: (projectId: string) =>
    api.post(`/projects/${projectId}/decline-invitation`),

  acceptJoinRequest: (projectId: string, userId: string) =>
    api.post<ProjectMember>(`/projects/${projectId}/requests/${userId}/accept`),

  rejectJoinRequest: (projectId: string, userId: string) =>
    api.post(`/projects/${projectId}/requests/${userId}/reject`),

  leaveProject: (projectId: string) => api.post(`/projects/${projectId}/leave`),

  removeMember: (projectId: string, userId: string) =>
    api.delete(`/projects/${projectId}/members/${userId}`),

  getPendingRequests: (projectId: string) =>
    api.get<ProjectMember[]>(`/projects/${projectId}/requests`),

  // Статус проекта
  activate: (projectId: string) =>
    api.post<Project>(`/projects/${projectId}/activate`),

  complete: (projectId: string) =>
    api.post<Project>(`/projects/${projectId}/complete`),
};
