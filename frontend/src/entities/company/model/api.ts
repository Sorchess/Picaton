import { api } from "@/shared/api";
import type {
  Company,
  CompanyWithRole,
  CompanyMember,
  CompanyInvitation,
  InvitationWithCompany,
  CreateCompanyRequest,
  UpdateCompanyRequest,
  CreateInvitationRequest,
  AcceptInvitationRequest,
  DeclineInvitationRequest,
  MessageResponse,
  InvitationStatus,
  CompanyCardAssignment,
  CompanyRoleFull,
  RolesListResponse,
  PermissionsListResponse,
  CreateRoleRequest,
  UpdateRoleRequest,
} from "./types";

export const companyApi = {
  // ==================== Company CRUD ====================

  /**
   * Создать новую компанию
   */
  create: (data: CreateCompanyRequest) => api.post<Company>("/companies", data),

  /**
   * Получить все компании текущего пользователя
   */
  getMyCompanies: () => api.get<CompanyWithRole[]>("/companies/my"),

  /**
   * Получить компанию по ID
   */
  getById: (companyId: string) => api.get<Company>(`/companies/${companyId}`),

  /**
   * Обновить компанию
   */
  update: (companyId: string, data: UpdateCompanyRequest) =>
    api.patch<Company>(`/companies/${companyId}`, data),

  /**
   * Удалить компанию
   */
  delete: (companyId: string) =>
    api.delete<MessageResponse>(`/companies/${companyId}`),

  // ==================== Roles ====================

  /**
   * Получить все доступные права
   */
  getPermissions: () =>
    api.get<PermissionsListResponse>("/companies/permissions"),

  /**
   * Получить роли компании
   */
  getRoles: (companyId: string) =>
    api.get<RolesListResponse>(`/companies/${companyId}/roles`),

  /**
   * Получить роль по ID
   */
  getRole: (companyId: string, roleId: string) =>
    api.get<CompanyRoleFull>(`/companies/${companyId}/roles/${roleId}`),

  /**
   * Создать новую роль
   */
  createRole: (companyId: string, data: CreateRoleRequest) =>
    api.post<CompanyRoleFull>(`/companies/${companyId}/roles`, data),

  /**
   * Обновить роль
   */
  updateRole: (companyId: string, roleId: string, data: UpdateRoleRequest) =>
    api.put<CompanyRoleFull>(`/companies/${companyId}/roles/${roleId}`, data),

  /**
   * Удалить роль
   */
  deleteRole: (
    companyId: string,
    roleId: string,
    replacementRoleId?: string
  ) => {
    const params = replacementRoleId
      ? `?replacement_role_id=${replacementRoleId}`
      : "";
    return api.delete<MessageResponse>(
      `/companies/${companyId}/roles/${roleId}${params}`
    );
  },

  // ==================== Members ====================

  /**
   * Получить членов компании
   */
  getMembers: (companyId: string, skip = 0, limit = 100) =>
    api.get<CompanyMember[]>(
      `/companies/${companyId}/members?skip=${skip}&limit=${limit}`
    ),

  /**
   * Изменить роль члена
   */
  updateMemberRole: (companyId: string, userId: string, roleId: string) =>
    api.patch<MessageResponse>(
      `/companies/${companyId}/members/${userId}/role`,
      { role_id: roleId }
    ),

  /**
   * Удалить члена из компании
   */
  removeMember: (companyId: string, userId: string) =>
    api.delete<MessageResponse>(`/companies/${companyId}/members/${userId}`),

  /**
   * Покинуть компанию
   */
  leave: (companyId: string) =>
    api.post<MessageResponse>(`/companies/${companyId}/leave`),

  // ==================== Invitations ====================

  /**
   * Создать приглашение
   */
  createInvitation: (companyId: string, data: CreateInvitationRequest) =>
    api.post<CompanyInvitation>(`/companies/${companyId}/invitations`, data),

  /**
   * Получить приглашения компании
   */
  getInvitations: (
    companyId: string,
    status?: InvitationStatus,
    skip = 0,
    limit = 100
  ) => {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
    });
    if (status) params.set("status_filter", status);
    return api.get<CompanyInvitation[]>(
      `/companies/${companyId}/invitations?${params}`
    );
  },

  /**
   * Отменить приглашение
   */
  cancelInvitation: (companyId: string, invitationId: string) =>
    api.delete<MessageResponse>(
      `/companies/${companyId}/invitations/${invitationId}`
    ),

  /**
   * Переотправить приглашение
   */
  resendInvitation: (companyId: string, invitationId: string) =>
    api.post<CompanyInvitation>(
      `/companies/${companyId}/invitations/${invitationId}/resend`
    ),

  // ==================== User Invitations ====================

  /**
   * Получить приглашения для текущего пользователя
   */
  getMyInvitations: () =>
    api.get<InvitationWithCompany[]>("/companies/invitations/my"),

  /**
   * Принять приглашение
   */
  acceptInvitation: (data: AcceptInvitationRequest) =>
    api.post<MessageResponse>("/companies/invitations/accept", data),

  /**
   * Отклонить приглашение
   */
  declineInvitation: (data: DeclineInvitationRequest) =>
    api.post<MessageResponse>("/companies/invitations/decline", data),

  // ==================== Card Selection ====================

  /**
   * Получить информацию о выбранных визитках для всех компаний
   */
  getMyCardAssignments: () =>
    api.get<CompanyCardAssignment[]>("/companies/card-assignments/my"),

  /**
   * Установить выбранную визитку для компании
   */
  setSelectedCard: (companyId: string, cardId: string | null) =>
    api.patch<CompanyCardAssignment>(`/companies/${companyId}/selected-card`, {
      card_id: cardId,
    }),
};
