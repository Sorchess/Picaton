// Типы для идей

export type IdeaStatus =
  | "draft"
  | "active"
  | "team_forming"
  | "team_formed"
  | "in_review"
  | "in_progress"
  | "completed"
  | "archived";
export type IdeaVisibility =
  | "public"
  | "company"
  | "department"
  | "private"
  | "connections_only";
export type SwipeDirection = "like" | "dislike" | "super_like";

export interface IdeaAuthor {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  reputation?: number | null;
}

// PRD структура
export interface PRD {
  problem_statement: string;
  solution_description: string;
  target_users: string;
  mvp_scope: string;
  success_metrics: string;
  risks: string;
  timeline: string;
  generated_by_ai: boolean;
}

export interface Idea {
  id: string;
  author_id: string;
  author?: IdeaAuthor | null;
  title: string;
  description: string;
  // PRD
  prd?: PRD | null;
  // Навыки
  required_skills: string[];
  ai_suggested_skills: string[];
  ai_suggested_roles: string[];
  skills_confidence: number;
  // Статус
  status: IdeaStatus;
  visibility: IdeaVisibility;
  company_id?: string | null;
  department_id?: string | null;
  // Статистика
  likes_count: number;
  super_likes_count: number;
  dislikes_count: number;
  views_count: number;
  comments_count: number;
  // Score
  idea_score: number;
  // Timestamps
  created_at: string;
  updated_at: string;
  published_at?: string | null;
}

export interface IdeaListResponse {
  ideas: Idea[];
  total: number;
}

export interface CreateIdeaRequest {
  title: string;
  description: string;
  required_skills?: string[];
  visibility?: IdeaVisibility;
  company_id?: string | null;
  department_id?: string | null;
}

export interface CreateIdeaFromVoiceRequest {
  transcript: string;
  visibility?: IdeaVisibility;
  company_id?: string | null;
  department_id?: string | null;
}

export interface GeneratePRDRequest {
  raw_input: string;
  input_type?: "text" | "voice_transcript";
  context?: string | null;
}

export interface GeneratedPRD {
  title: string;
  problem_statement: string;
  solution_description: string;
  target_users: string;
  mvp_scope: string;
  success_metrics: string;
  risks: string;
  timeline: string;
  required_skills: string[];
  roles: string[];
  confidence: number;
}

export interface UpdateIdeaRequest {
  title?: string;
  description?: string;
  required_skills?: string[];
  visibility?: IdeaVisibility;
  // PRD поля
  problem_statement?: string;
  solution_description?: string;
  target_users?: string;
  mvp_scope?: string;
  success_metrics?: string;
  risks?: string;
  timeline?: string;
}

export interface SwipeRequest {
  idea_id: string;
  direction: SwipeDirection;
  feedback?: string | null;
  engagement_time_seconds?: number | null;
}

export interface SwipeResponse {
  swipe_id: string;
  idea_id: string;
  direction: SwipeDirection;
  is_match: boolean;
  match_user_ids: string[];
  // Gamification
  points_earned: number;
  new_badges: string[];
  current_streak: number;
}

export interface MatchedExpert {
  user_id: string;
  card_id?: string | null;
  display_name: string;
  avatar_url?: string | null;
  bio?: string | null;
  matching_skills: string[];
  all_skills: string[];
  match_score: number;
}

export interface TeamSuggestion {
  experts: MatchedExpert[];
  coverage: number;
  missing_skills: string[];
  team_score: number;
}

export interface IdeaAnalysis {
  skills: string[];
  roles: string[];
  priority_skills: string[];
  recommended_skills: string[];
  suggested_roles: string[];
}

// ============ Comments ============

export interface IdeaComment {
  id: string;
  idea_id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  content: string;
  is_question: boolean;
  created_at: string;
}

export interface CommentListResponse {
  comments: IdeaComment[];
  total: number;
}

export interface AddCommentRequest {
  content: string;
  is_question?: boolean;
}

// ============ Leaderboard ============

export interface LeaderboardIdea {
  id: string;
  title: string;
  author: IdeaAuthor;
  idea_score: number;
  likes_count: number;
  super_likes_count: number;
  rank: number;
}

export interface IdeaLeaderboardResponse {
  ideas: LeaderboardIdea[];
  period: string;
}

// ============ Gamification ============

export interface UserGamification {
  total_points: number;
  weekly_points: number;
  monthly_points: number;
  level: number;
  badges: string[];
  current_voting_streak: number;
  max_voting_streak: number;
  reputation: number;
  ideas_count: number;
  swipes_count: number;
  projects_count: number;
  completed_projects_count: number;
}

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  points: number;
  level: number;
  badges_count: number;
  rank: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  period: string;
  my_rank: number | null;
}

// Helper функции
export function getAuthorFullName(idea: Idea): string {
  if (!idea.author) return "Неизвестный автор";
  return `${idea.author.first_name} ${idea.author.last_name}`.trim();
}

export function getStatusLabel(status: IdeaStatus): string {
  const labels: Record<IdeaStatus, string> = {
    draft: "Черновик",
    active: "Активна",
    team_forming: "Набор команды",
    team_formed: "Команда собрана",
    in_review: "На рассмотрении",
    in_progress: "В работе",
    completed: "Завершено",
    archived: "В архиве",
  };
  return labels[status] || status;
}

export function getVisibilityLabel(visibility: IdeaVisibility): string {
  const labels: Record<IdeaVisibility, string> = {
    public: "Публичная",
    company: "В компании",
    department: "В отделе",
    private: "Личная",
    connections_only: "Только для контактов",
  };
  return labels[visibility] || visibility;
}

export function getBadgeLabel(badge: string): string {
  const labels: Record<string, string> = {
    innovator: "🚀 Инноватор",
    idea_machine: "💡 Генератор идей",
    visionary: "🔮 Визионер",
    voter: "👍 Голосующий",
    active_voter: "🗳️ Активный голосующий",
    super_voter: "⭐ Супер голосующий",
    team_builder: "👥 Командный игрок",
    collaborator: "🤝 Коллаборатор",
    mentor: "🎓 Ментор",
    project_starter: "🎯 Стартер проектов",
    project_finisher: "🏆 Финишер",
    serial_finisher: "🌟 Серийный финишер",
    streak_3: "🔥 3 дня подряд",
    streak_7: "🔥🔥 Неделя подряд",
    streak_30: "🔥🔥🔥 Месяц подряд",
    popular: "❤️ Популярный",
    super_popular: "💖 Суперпопулярный",
    chat_active: "💬 Активный в чате",
  };
  return labels[badge] || badge;
}
