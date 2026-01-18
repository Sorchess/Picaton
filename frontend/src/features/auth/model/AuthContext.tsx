import { useState, useEffect, useCallback, type ReactNode } from "react";
import type { User } from "@/entities/user";
import { authApi } from "./api";
import type { LoginCredentials, RegisterData, TelegramAuthData } from "./types";
import { AuthContext } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async (showLoading = false) => {
    if (!authApi.isAuthenticated()) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    // Показываем loading только при явном запросе или если user ещё не загружен
    if (showLoading) {
      setIsLoading(true);
    }

    try {
      const userData = await authApi.getMe();
      setUser(userData);
    } catch {
      authApi.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser(true); // При первой загрузке показываем loading
  }, [refreshUser]);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      await authApi.login(credentials);
      // Получаем данные пользователя без дополнительного loading
      const userData = await authApi.getMe();
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    setIsLoading(true);
    try {
      const authUser = await authApi.register(data);
      // Устанавливаем пользователя напрямую из ответа регистрации,
      // чтобы избежать дополнительного запроса к /auth/me
      setUser({
        id: authUser.id,
        first_name: authUser.first_name,
        last_name: authUser.last_name,
        email: authUser.email,
        avatar_url: authUser.avatar_url,
        location: null,
        bio: null,
        ai_generated_bio: null,
        status: "active",
        tags: [],
        search_tags: [],
        contacts: [],
        random_facts: [],
        profile_completeness: 0,
        is_public: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
  };

  const requestMagicLink = async (email: string) => {
    await authApi.requestMagicLink({ email });
  };

  const verifyMagicLink = async (token: string) => {
    setIsLoading(true);
    try {
      await authApi.verifyMagicLink({ token });
      // Получаем полные данные пользователя с сервера (без отдельного loading)
      const userData = await authApi.getMe();
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  };

  const telegramLogin = async (data: TelegramAuthData) => {
    setIsLoading(true);
    try {
      await authApi.telegramAuth(data);
      // Получаем полные данные пользователя с сервера (без отдельного loading)
      const userData = await authApi.getMe();
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        requestMagicLink,
        verifyMagicLink,
        telegramLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
