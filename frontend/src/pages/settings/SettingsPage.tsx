import { useAuth } from "@/features/auth";
import { Avatar, IconButton } from "@/shared";
import "./SettingsPage.scss";

interface SettingsPageProps {
  onOpenCompanies?: () => void;
  onBack?: () => void;
}

export function SettingsPage({ onOpenCompanies, onBack }: SettingsPageProps) {
  const { user, logout } = useAuth();

  const userInitials =
    (user?.first_name?.[0] || "") + (user?.last_name?.[0] || "");

  return (
    <div className="settings-page">
      {/* Заголовок */}
      <header className="settings-page__header">
        <IconButton aria-label="Назад" onClick={onBack}>
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
            <path
              d="M9 1L1 9L9 17"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
        <div className="settings-page__title-container">
          <h1 className="settings-page__title">Настройки</h1>
        </div>
        <div style={{ width: 36 }} />
      </header>

      {/* Аккаунт */}
      <div className="settings-page__list">
        <div className="settings-page__card">
          <div className="settings-page__card-avatar">
            <Avatar
              src={user?.avatar_url || undefined}
              initials={userInitials || "?"}
              size="md"
            />
          </div>
          <div className="settings-page__card-content">
            <div className="settings-page__card-top">
              <span className="settings-page__card-name">
                {user?.first_name} {user?.last_name}
              </span>
            </div>
            <div className="settings-page__card-bottom">
              <span className="settings-page__card-preview">
                {user?.email || "Нет email"}
              </span>
            </div>
          </div>
        </div>

        {/* Компании */}
        <button
          className="settings-page__card"
          onClick={onOpenCompanies}
          type="button"
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              width="32"
              height="32"
              rx="8.96"
              fill="url(#paint0_linear_1147_35730)"
            />
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M18.25 8.5H19.75C21.1642 8.5 21.8713 8.5 22.3107 8.93934C22.75 9.37868 22.75 10.0858 22.75 11.5V22.9375H23.5C23.8107 22.9375 24.0625 23.1893 24.0625 23.5C24.0625 23.8107 23.8107 24.0625 23.5 24.0625H8.5C8.18934 24.0625 7.9375 23.8107 7.9375 23.5C7.9375 23.1893 8.18934 22.9375 8.5 22.9375H9.25V13.75C9.25 12.3358 9.25 11.6287 9.68934 11.1893C10.1287 10.75 10.8358 10.75 12.25 10.75H15.25C16.6642 10.75 17.3713 10.75 17.8107 11.1893C18.25 11.6287 18.25 12.3358 18.25 13.75V22.9375H19.375V13.75L19.375 13.6829C19.3751 13.0337 19.3752 12.4384 19.3101 11.9542C19.2384 11.421 19.0697 10.8574 18.6062 10.3938C18.1426 9.93031 17.579 9.76164 17.0458 9.68995C16.5684 9.62576 15.9831 9.62493 15.3445 9.62499C15.4077 9.33456 15.5132 9.11544 15.6893 8.93934C16.1287 8.5 16.8358 8.5 18.25 8.5ZM10.9375 13C10.9375 12.6893 11.1893 12.4375 11.5 12.4375H16C16.3107 12.4375 16.5625 12.6893 16.5625 13C16.5625 13.3107 16.3107 13.5625 16 13.5625H11.5C11.1893 13.5625 10.9375 13.3107 10.9375 13ZM10.9375 15.25C10.9375 14.9393 11.1893 14.6875 11.5 14.6875H16C16.3107 14.6875 16.5625 14.9393 16.5625 15.25C16.5625 15.5607 16.3107 15.8125 16 15.8125H11.5C11.1893 15.8125 10.9375 15.5607 10.9375 15.25ZM10.9375 17.5C10.9375 17.1893 11.1893 16.9375 11.5 16.9375H16C16.3107 16.9375 16.5625 17.1893 16.5625 17.5C16.5625 17.8107 16.3107 18.0625 16 18.0625H11.5C11.1893 18.0625 10.9375 17.8107 10.9375 17.5ZM13.75 20.6875C14.0607 20.6875 14.3125 20.9393 14.3125 21.25V22.9375H13.1875V21.25C13.1875 20.9393 13.4393 20.6875 13.75 20.6875Z"
              fill="white"
            />
            <defs>
              <linearGradient
                id="paint0_linear_1147_35730"
                x1="16"
                y1="0"
                x2="16"
                y2="32"
                gradientUnits="userSpaceOnUse"
              >
                <stop stop-color="#7700FF" />
                <stop offset="1" stop-color="#A200FF" />
              </linearGradient>
            </defs>
          </svg>
          <div className="settings-page__card-content">
            <div className="settings-page__card-top">
              <span className="settings-page__card-name">Компании</span>
              <svg
                className="settings-page__card-arrow"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="9,18 15,12 9,6" />
              </svg>
            </div>
          </div>
        </button>

        {/* Выйти */}
        <button
          className="settings-page__card settings-page__card--danger"
          onClick={logout}
          type="button"
        >
          <div className="settings-page__card-icon settings-page__card-icon--danger">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16,17 21,12 16,7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>
          <div className="settings-page__card-content">
            <div className="settings-page__card-top">
              <span className="settings-page__card-name">
                Выйти из аккаунта
              </span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
