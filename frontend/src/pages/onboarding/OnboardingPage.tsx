import { useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth";
import { userApi } from "@/entities/user";
import { Typography, Button, Input } from "@/shared";
import "./OnboardingPage.scss";

type OnboardingStep = "welcome" | "profile" | "complete";

export function OnboardingPage() {
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [location, setLocation] = useState(user?.location || "");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("Имя и фамилия обязательны для заполнения");
      return;
    }

    if (!user?.id) {
      setError("Ошибка авторизации");
      return;
    }

    setIsLoading(true);

    try {
      await userApi.update(user.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        bio: bio.trim() || null,
        location: location.trim() || null,
      });

      setStep("complete");

      // Обновляем данные пользователя в контексте
      await refreshUser();

      // Автоматический переход на главную через 2 секунды
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error("Error updating profile:", err);
      setError("Не удалось сохранить данные. Попробуйте ещё раз.");
    } finally {
      setIsLoading(false);
    }
  };

  // Экран приветствия
  if (step === "welcome") {
    return (
      <div className="onboarding">
        <div className="onboarding__container">
          <div className="onboarding__header">
            <div className="onboarding__icon">🎉</div>
            <Typography variant="h1" className="onboarding__title">
              Добро пожаловать в Picaton!
            </Typography>
            <Typography variant="body" className="onboarding__subtitle">
              Расскажите о себе, чтобы другие участники могли вас найти
            </Typography>
          </div>

          <div className="onboarding__features">
            <div className="onboarding__feature">
              <span className="onboarding__feature-icon">🔍</span>
              <div className="onboarding__feature-content">
                <Typography
                  variant="body"
                  className="onboarding__feature-title"
                >
                  Находите специалистов
                </Typography>
                <Typography
                  variant="small"
                  className="onboarding__feature-desc"
                >
                  Ищите людей по навыкам и интересам
                </Typography>
              </div>
            </div>
            <div className="onboarding__feature">
              <span className="onboarding__feature-icon">🤝</span>
              <div className="onboarding__feature-content">
                <Typography
                  variant="body"
                  className="onboarding__feature-title"
                >
                  Создавайте связи
                </Typography>
                <Typography
                  variant="small"
                  className="onboarding__feature-desc"
                >
                  Обменивайтесь контактами через QR-коды
                </Typography>
              </div>
            </div>
            <div className="onboarding__feature">
              <span className="onboarding__feature-icon">✨</span>
              <div className="onboarding__feature-content">
                <Typography
                  variant="body"
                  className="onboarding__feature-title"
                >
                  AI-презентация
                </Typography>
                <Typography
                  variant="small"
                  className="onboarding__feature-desc"
                >
                  ИИ создаст вашу уникальную визитку
                </Typography>
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            className="onboarding__submit"
            onClick={() => setStep("profile")}
          >
            Начать заполнение
          </Button>
        </div>
      </div>
    );
  }

  // Экран успешного завершения
  if (step === "complete") {
    return (
      <div className="onboarding">
        <div className="onboarding__container">
          <div className="onboarding__header">
            <div className="onboarding__icon onboarding__icon--success">✅</div>
            <Typography variant="h1" className="onboarding__title">
              Профиль создан!
            </Typography>
            <Typography variant="body" className="onboarding__subtitle">
              Отлично, {firstName}! Теперь вы можете пользоваться платформой
            </Typography>
          </div>

          <div className="onboarding__next-steps">
            <Typography variant="body" className="onboarding__next-title">
              Что дальше:
            </Typography>
            <ul className="onboarding__next-list">
              <li>Добавьте теги навыков</li>
              <li>Загрузите аватар</li>
              <li>Добавьте контакты для связи</li>
            </ul>
          </div>

          <div className="onboarding__loader">
            <div className="onboarding__spinner" />
            <Typography variant="small">Переходим в приложение...</Typography>
          </div>
        </div>
      </div>
    );
  }

  // Форма заполнения профиля
  return (
    <div className="onboarding">
      <div className="onboarding__container">
        <div className="onboarding__header">
          <div className="onboarding__step-indicator">
            <span className="onboarding__step-badge">Шаг 1 из 1</span>
          </div>
          <Typography variant="h1" className="onboarding__title">
            Основная информация
          </Typography>
          <Typography variant="body" className="onboarding__subtitle">
            Эти данные будут видны другим пользователям
          </Typography>
        </div>

        <form className="onboarding__form" onSubmit={handleSubmit}>
          <div className="onboarding__row">
            <div className="onboarding__field">
              <label className="onboarding__label">
                Имя <span className="onboarding__required">*</span>
              </label>
              <Input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Иван"
                autoFocus
                disabled={isLoading}
              />
            </div>
            <div className="onboarding__field">
              <label className="onboarding__label">
                Фамилия <span className="onboarding__required">*</span>
              </label>
              <Input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Иванов"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="onboarding__field">
            <label className="onboarding__label">Информация о себе</label>
            <textarea
              className="onboarding__textarea"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Расскажите о себе, своих навыках и интересах..."
              disabled={isLoading}
              rows={4}
            />
            <span className="onboarding__hint">
              Краткое описание поможет людям узнать вас лучше
            </span>
          </div>

          <div className="onboarding__field">
            <label className="onboarding__label">Город</label>
            <Input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Москва, Санкт-Петербург..."
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="onboarding__error">
              <Typography variant="small">{error}</Typography>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="onboarding__submit"
            disabled={isLoading || !firstName.trim() || !lastName.trim()}
          >
            {isLoading ? (
              <>
                <span className="onboarding__btn-spinner" />
                Сохраняем...
              </>
            ) : (
              "Сохранить и продолжить"
            )}
          </Button>

          <Typography variant="small" className="onboarding__skip-hint">
            Вы сможете дополнить профиль позже
          </Typography>
        </form>
      </div>
    </div>
  );
}
