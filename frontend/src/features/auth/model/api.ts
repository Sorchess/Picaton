import { api, tokenStorage } from "@/shared/api";
import type { User } from "@/entities/user";
import type {
  AuthUser,
  LoginCredentials,
  RegisterData,
  MagicLinkRequest,
  MagicLinkResponse,
  MagicLinkVerifyRequest,
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
};
