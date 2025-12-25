import { useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth";
import { Typography, Button, Input } from "@/shared";
import { ApiError } from "@/shared/api";
import "./AuthPage.scss";

interface AuthPageProps {
  onSwitchToRegister: () => void;
}

export function LoginPage({ onSwitchToRegister }: AuthPageProps) {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await login({ email, password });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError("Неверный email или пароль");
        } else if (err.status === 404) {
          setError("Пользователь не найден");
        } else {
          const data = err.data as { detail?: string } | null;
          setError(data?.detail || "Ошибка авторизации");
        }
      } else {
        setError(err instanceof Error ? err.message : "Ошибка входа");
      }
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__container">
        <div className="auth-page__header">
          <div className="auth-page__logo">
            <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
              <defs>
                <linearGradient
                  id="authLogoGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="50%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#d946ef" />
                </linearGradient>
              </defs>
              <circle cx="16" cy="16" r="14" fill="url(#authLogoGradient)" />
              <path
                d="M10 12h4v8h-4v-8zm8 0h4v8h-4v-8zm-4 2h4v4h-4v-4z"
                fill="white"
                opacity="0.9"
              />
            </svg>
          </div>
          <Typography variant="h1" className="auth-page__title">
            Picaton
          </Typography>
          <Typography variant="body" className="auth-page__subtitle">
            Войдите в свой аккаунт
          </Typography>
        </div>

        <form className="auth-page__form" onSubmit={handleSubmit}>
          {error && (
            <div className="auth-page__error">
              <Typography variant="small">{error}</Typography>
            </div>
          )}

          <div className="auth-page__field">
            <label className="auth-page__label">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="auth-page__field">
            <label className="auth-page__label">Пароль</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="auth-page__submit"
            disabled={isLoading}
          >
            {isLoading ? "Вход..." : "Войти"}
          </Button>
        </form>

        <div className="auth-page__footer">
          <Typography variant="small">
            Нет аккаунта?{" "}
            <button
              type="button"
              className="auth-page__link"
              onClick={onSwitchToRegister}
            >
              Зарегистрироваться
            </button>
          </Typography>
        </div>
      </div>
    </div>
  );
}
