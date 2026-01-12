import { api } from "@/shared/api";
import type {
  Idea,
  IdeaListResponse,
  CreateIdeaRequest,
  CreateIdeaFromVoiceRequest,
  GeneratePRDRequest,
  GeneratedPRD,
  UpdateIdeaRequest,
  SwipeRequest,
  SwipeResponse,
  MatchedExpert,
  TeamSuggestion,
  IdeaAnalysis,
  IdeaComment,
  CommentListResponse,
  AddCommentRequest,
  IdeaLeaderboardResponse,
  UserGamification,
  LeaderboardResponse,
} from "./types";
import type { Project } from "@/entities/project";

export const ideaApi = {
  // ============ CRUD ============

  create: (data: CreateIdeaRequest) => api.post<Idea>("/ideas", data),

  createFromVoice: (data: CreateIdeaFromVoiceRequest) =>
    api.post<Idea>("/ideas/from-voice", data),

  get: (ideaId: string) => api.get<Idea>(`/ideas/${ideaId}`),

  getById: (ideaId: string) => api.get<Idea>(`/ideas/${ideaId}`),

  update: (ideaId: string, data: UpdateIdeaRequest) =>
    api.put<Idea>(`/ideas/${ideaId}`, data),

  delete: (ideaId: string) => api.delete(`/ideas/${ideaId}`),

  // ============ PRD Generation ============

  generatePRD: (data: GeneratePRDRequest) =>
    api.post<GeneratedPRD>("/ideas/generate-prd", data),

  // ============ Мои идеи ============

  getMyIdeas: (status?: string, limit = 50, offset = 0) => {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    return api.get<IdeaListResponse>(`/ideas/my?${params.toString()}`);
  },

  // ============ Лента для свайпа ============

  getFeed: (limit = 20, companyId?: string) => {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    if (companyId) params.append("company_id", companyId);
    return api.get<IdeaListResponse>(`/ideas/feed?${params.toString()}`);
  },

  // ============ Публикация / Архивирование ============

  publish: (ideaId: string) => api.post<Idea>(`/ideas/${ideaId}/publish`),

  archive: (ideaId: string) => api.post<Idea>(`/ideas/${ideaId}/archive`),

  // ============ AI анализ ============

  analyze: (ideaId: string) =>
    api.get<IdeaAnalysis>(`/ideas/${ideaId}/analysis`),

  // ============ Поиск экспертов ============

  getMatches: (ideaId: string, limit = 20) =>
    api.get<MatchedExpert[]>(`/ideas/${ideaId}/matches?limit=${limit}`),

  findMatchingExperts: (ideaId: string, options?: { limit?: number }) =>
    api.get<{
      experts: Array<{
        user_id: string;
        first_name: string;
        last_name: string;
        avatar_url?: string;
        matching_skills: string[];
        other_skills: string[];
        match_score: number;
        bio?: string;
      }>;
    }>(`/ideas/${ideaId}/matches?limit=${options?.limit || 20}`),

  // ============ Предложение команды ============

  getTeamSuggestion: (ideaId: string, maxTeamSize = 5) =>
    api.get<TeamSuggestion>(
      `/ideas/${ideaId}/team-suggestion?max_team_size=${maxTeamSize}`
    ),

  // ============ Свайпы ============

  swipe: (data: SwipeRequest) => api.post<SwipeResponse>("/ideas/swipe", data),

  undoSwipe: (ideaId: string) => api.delete(`/ideas/swipe/${ideaId}`),

  // ============ Полученные лайки ============

  getReceivedLikes: (limit = 50) =>
    api.get<Array<{ user_id: string; idea_id: string; idea_title: string }>>(
      `/ideas/likes/received?limit=${limit}`
    ),

  // ============ Комментарии ============

  getComments: (ideaId: string, limit = 50, offset = 0) =>
    api.get<CommentListResponse>(
      `/ideas/${ideaId}/comments?limit=${limit}&offset=${offset}`
    ),

  addComment: (ideaId: string, data: AddCommentRequest) =>
    api.post<IdeaComment>(`/ideas/${ideaId}/comments`, data),

  // ============ Leaderboard ============

  getLeaderboard: (
    period = "all",
    companyId?: string,
    departmentId?: string,
    limit = 10
  ) => {
    const params = new URLSearchParams();
    params.append("period", period);
    if (companyId) params.append("company_id", companyId);
    if (departmentId) params.append("department_id", departmentId);
    params.append("limit", limit.toString());
    return api.get<IdeaLeaderboardResponse>(
      `/ideas/leaderboard?${params.toString()}`
    );
  },

  // ============ Gamification ============

  getMyGamification: () => api.get<UserGamification>("/ideas/gamification/me"),

  getUsersLeaderboard: (
    period = "all",
    companyId?: string,
    departmentId?: string,
    limit = 10
  ) => {
    const params = new URLSearchParams();
    params.append("period", period);
    if (companyId) params.append("company_id", companyId);
    if (departmentId) params.append("department_id", departmentId);
    params.append("limit", limit.toString());
    return api.get<LeaderboardResponse>(
      `/ideas/gamification/leaderboard?${params.toString()}`
    );
  },

  // ============ Создание проекта из идеи ============

  createProject: (ideaId: string) =>
    api.post<Project>(`/ideas/${ideaId}/create-project`),

  createProjectWithTeam: (ideaId: string, teamMemberIds: string[]) =>
    api.post<Project>(`/ideas/${ideaId}/create-project`, {
      team_member_ids: teamMemberIds,
    }),
};
