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
}

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  email: string;
  avatar_url: string | null;
  location: string | null;
  bio: string | null;
  ai_generated_bio: string | null;
  position?: string | null;
  status: string;
  tags: TagInfo[];
  search_tags: string[];
  contacts: ContactInfo[];
  random_facts: string[];
  profile_completeness: number;
  created_at?: string;
  updated_at?: string;
}

// Computed getter-like function
export function getFullName(user: User | UserPublic): string {
  const parts = [user.last_name, user.first_name];
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
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  search_tags: string[];
  source: string;
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  users: UserPublic[];
  contacts: SavedContact[];
  query: string;
  total_count: number;
  total: number;
  suggested_tags?: string[];
}

export interface ImportResult {
  imported_count: number;
  skipped_count: number;
  errors: string[];
}
