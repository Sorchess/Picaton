import type { User } from "@/entities/user";

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  telegram_id?: number | null;
  telegram_username?: string | null;
  access_token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface MagicLinkRequest {
  email: string;
}

export interface MagicLinkResponse {
  message: string;
  email: string;
}

export interface MagicLinkVerifyRequest {
  token: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Telegram авторизация

export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface TelegramConfig {
  bot_username: string;
  enabled: boolean;
}

export interface TelegramContact {
  telegram_id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  phone?: string;
}

export interface TelegramFoundContact {
  user_id: string;
  user_name: string;
  contact_name?: string;
  avatar_url?: string;
  telegram_username?: string;
}

export interface TelegramContactsSyncResponse {
  found: TelegramFoundContact[];
  found_count: number;
  total: number;
}
