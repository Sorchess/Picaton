import { useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth";
import { Typography, Button, Input } from "@/shared";
import { ApiError } from "@/shared/api";
import { useI18n } from "@/shared/config";
import "./AuthPage.scss";

interface AuthPageProps {
  onSwitchToLogin: () => void;
}

export function RegisterPage({ onSwitchToLogin }: AuthPageProps) {
  const { register, isLoading } = useAuth();
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    first_name: "",
    last_name: "",
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange =
    (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError(t("register.passwordsMismatch"));
      return;
    }

    if (formData.password.length < 6) {
      setError(t("register.passwordTooShort"));
      return;
    }

    try {
      await register({
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError(t("register.emailExists"));
        } else {
          const data = err.data as { detail?: string } | null;
          setError(data?.detail || t("register.registrationError"));
        }
      } else {
        setError(
          err instanceof Error ? err.message : t("register.registrationError"),
        );
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
              {/* Network nodes */}
              <circle cx="16" cy="10" r="2.5" fill="white" />
              <circle cx="10" cy="20" r="2.5" fill="white" />
              <circle cx="22" cy="20" r="2.5" fill="white" />
              <circle cx="16" cy="16" r="3" fill="white" opacity="0.9" />
              {/* Connection lines */}
              <line
                x1="16"
                y1="10"
                x2="16"
                y2="16"
                stroke="white"
                strokeWidth="1.5"
                opacity="0.7"
              />
              <line
                x1="16"
                y1="16"
                x2="10"
                y2="20"
                stroke="white"
                strokeWidth="1.5"
                opacity="0.7"
              />
              <line
                x1="16"
                y1="16"
                x2="22"
                y2="20"
                stroke="white"
                strokeWidth="1.5"
                opacity="0.7"
              />
            </svg>
          </div>
          <Typography variant="h1" className="auth-page__title">
            Picaton
          </Typography>
          <Typography variant="body" className="auth-page__subtitle">
            {t("register.createAccount")}
          </Typography>
        </div>

        <form className="auth-page__form" onSubmit={handleSubmit}>
          {error && (
            <div className="auth-page__error">
              <Typography variant="small">{error}</Typography>
            </div>
          )}

          <div className="auth-page__row">
            <div className="auth-page__field">
              <label className="auth-page__label">
                {t("register.firstName")}
              </label>
              <Input
                type="text"
                value={formData.first_name}
                onChange={handleChange("first_name")}
                placeholder={t("register.firstNamePlaceholder")}
                required
              />
            </div>

            <div className="auth-page__field">
              <label className="auth-page__label">
                {t("register.lastName")}
              </label>
              <Input
                type="text"
                value={formData.last_name}
                onChange={handleChange("last_name")}
                placeholder={t("register.lastNamePlaceholder")}
                required
              />
            </div>
          </div>

          <div className="auth-page__field">
            <label className="auth-page__label">Email</label>
            <Input
              type="email"
              value={formData.email}
              onChange={handleChange("email")}
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="auth-page__field">
            <label className="auth-page__label">{t("register.password")}</label>
            <Input
              type="password"
              value={formData.password}
              onChange={handleChange("password")}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="auth-page__field">
            <label className="auth-page__label">
              {t("register.confirmPassword")}
            </label>
            <Input
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange("confirmPassword")}
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
            {isLoading ? t("register.registering") : t("register.register")}
          </Button>
        </form>

        <div className="auth-page__footer">
          <Typography variant="small">
            {t("register.haveAccount")}{" "}
            <button
              type="button"
              className="auth-page__link"
              onClick={onSwitchToLogin}
            >
              {t("register.login")}
            </button>
          </Typography>
        </div>
      </div>
    </div>
  );
}
