import { api, tokenStorage } from "@/shared/api";
import type { User } from "@/entities/user";
import type {
  AuthUser,
  LoginCredentials,
  RegisterData,
  MagicLinkRequest,
  MagicLinkResponse,
  MagicLinkVerifyRequest,
  TelegramAuthData,
  TelegramConfig,
  TelegramContact,
  TelegramContactsSyncResponse,
  TelegramDeepLinkResponse,
  TelegramAuthStatusResponse,
  ContactSyncSessionResponse,
  ContactSyncStatusResponse,
} from "./types";

export const authApi = {
  register: async (data: RegisterData): Promise<AuthUser> => {
    const response = await api.post<AuthUser>("/auth/register", data);
    tokenStorage.set(response.access_token);
    return response;
  },

  login: async (credentials: LoginCredentials): Promise<AuthUser> => {
    const response = await api.post<AuthUser>("/auth/login", credentials);
    tokenStorage.set(response.access_token);
    return response;
  },

  logout: (): void => {
    tokenStorage.remove();
  },

  getMe: async (): Promise<User> => {
    return api.get<User>("/auth/me");
  },

  isAuthenticated: (): boolean => {
    return !!tokenStorage.get();
  },

  // Magic Link (Passwordless)
  requestMagicLink: async (
    data: MagicLinkRequest
  ): Promise<MagicLinkResponse> => {
    return api.post<MagicLinkResponse>("/auth/magic-link", data);
  },

  verifyMagicLink: async (data: MagicLinkVerifyRequest): Promise<AuthUser> => {
    const response = await api.post<AuthUser>("/auth/magic-link/verify", data);
    tokenStorage.set(response.access_token);
    return response;
  },

  // Telegram Widget авторизация
  getTelegramConfig: async (): Promise<TelegramConfig> => {
    return api.get<TelegramConfig>("/auth/telegram/config");
  },

  telegramAuth: async (data: TelegramAuthData): Promise<AuthUser> => {
    const response = await api.post<AuthUser>("/auth/telegram", data);
    tokenStorage.set(response.access_token);
    return response;
  },

  // Telegram Deep Link авторизация (открывает приложение Telegram)
  createTelegramDeepLink: async (): Promise<TelegramDeepLinkResponse> => {
    return api.post<TelegramDeepLinkResponse>("/auth/telegram/deeplink", {});
  },

  checkTelegramAuthStatus: async (
    token: string
  ): Promise<TelegramAuthStatusResponse> => {
    return api.get<TelegramAuthStatusResponse>(
      `/auth/telegram/status/${token}`
    );
  },

  // Синхронизация контактов
  syncTelegramContacts: async (
    contacts: TelegramContact[]
  ): Promise<TelegramContactsSyncResponse> => {
    return api.post<TelegramContactsSyncResponse>(
      "/auth/telegram/sync-contacts",
      {
        contacts,
      }
    );
  },

  // Синхронизация контактов через бота (deep link)
  createContactSyncSession: async (): Promise<ContactSyncSessionResponse> => {
    return api.post<ContactSyncSessionResponse>(
      "/auth/telegram/sync-session",
      {}
    );
  },

  checkContactSyncStatus: async (
    token: string
  ): Promise<ContactSyncStatusResponse> => {
    return api.get<ContactSyncStatusResponse>(
      `/auth/telegram/sync-status/${token}`
    );
  },
};
