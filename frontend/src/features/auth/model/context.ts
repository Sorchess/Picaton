import { createContext } from "react";
import type { User } from "@/entities/user";
import type { LoginCredentials, RegisterData, TelegramAuthData } from "./types";

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshUser: (showLoading?: boolean) => Promise<void>;
  requestMagicLink: (email: string) => Promise<void>;
  verifyMagicLink: (token: string) => Promise<void>;
  telegramLogin: (data: TelegramAuthData) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);
