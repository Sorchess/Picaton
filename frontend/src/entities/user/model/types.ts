// Типы пользователя

export interface TagInfo {
  id: string;
  name: string;
  category: string;
  proficiency: number;
}

export interface ContactInfo {
  type: string;
  value: string;
  is_primary: boolean;
  is_visible: boolean;
}

// Типы контактов для отображения
export type ContactType =
  | "telegram"
  | "whatsapp"
  | "vk"
  | "messenger"
  | "email"
  | "phone"
  | "linkedin"
  | "github"
  | "instagram"
  | "tiktok"
  | "slack";

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  email: string;
  avatar_url: string | null;
  telegram_id?: number | null;
  telegram_username?: string | null;
  location: string | null;
  bio: string | null;
  ai_generated_bio: string | null;
  position?: string | null;
  username?: string | null;
  status: string;
  tags: TagInfo[];
  search_tags: string[];
  contacts: ContactInfo[];
  random_facts: string[];
  profile_completeness: number;
  is_public: boolean;
  is_onboarded?: boolean;
  privacy_who_can_message?: string;
  privacy_who_can_see_profile?: string;
  privacy_who_can_invite?: string;
  created_at?: string;
  updated_at?: string;
}

// Computed getter-like function
export function getFullName(user: User | UserPublic): string {
  const parts = [user.first_name, user.last_name];
  if ("middle_name" in user && user.middle_name) {
    parts.push(user.middle_name);
  }
  return parts.filter(Boolean).join(" ");
}

export interface UserPublic {
  id: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  avatar_url: string | null;
  bio: string | null;
  ai_generated_bio: string | null;
  location: string | null;
  position?: string | null;
  tags: TagInfo[];
  search_tags: string[];
  contacts: ContactInfo[]; // Публичные контакты для связи
  profile_completeness: number;
}

export interface UserCreate {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface UserUpdate {
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  location?: string | null;
  position?: string | null;
  username?: string | null;
}

export interface QRCodeResponse {
  image_base64: string;
  qr_code_base64?: string;
  image_format: string;
}

export interface SavedContact {
  id: string;
  owner_id: string;
  saved_user_id: string | null;
  saved_card_id: string | null; // ID конкретной карточки
  name: string; // Legacy: full_name
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  avatar_url?: string | null;
  contacts: ContactInfo[]; // Контакты для связи (telegram, whatsapp и т.д.)
  messenger_type: string | null;
  messenger_value: string | null;
  notes: string | null;
  search_tags: string[];
  source: string;
  created_at: string;
  updated_at: string;
}

// Контакт в карточке поиска
export interface SearchCardContact {
  type: string;
  value: string;
  is_primary: boolean;
}

// Карточка в результатах поиска
export interface SearchCardResult {
  id: string;
  owner_id: string;
  display_name: string;
  owner_first_name: string;
  owner_last_name: string;
  avatar_url: string | null;
  bio: string | null;
  ai_generated_bio: string | null;
  search_tags: string[];
  contacts: SearchCardContact[];
  completeness: number;
}

export interface SearchResult {
  users: UserPublic[]; // deprecated
  cards: SearchCardResult[]; // визитные карточки
  contacts: SavedContact[];
  query: string;
  expanded_tags: string[];
  total_count: number;
}

export interface ImportResult {
  imported_count: number;
  skipped_count: number;
  errors: string[];
}

export interface PrivacySettings {
  who_can_message: string;
  who_can_see_profile: string;
  who_can_invite: string;
}

export interface UserNotification {
  id: string;
  user_id: string;
  type: string; // "contact_added", ...
  title: string;
  message: string;
  is_read: boolean;
  actor_id: string | null;
  actor_name: string | null;
  actor_avatar_url: string | null;
  data: Record<string, unknown>;
  created_at: string;
}
