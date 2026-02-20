import { useAuth } from "@/features/auth";
import { IconButton, GlassSelect } from "@/shared";
import { useTheme } from "@/shared/config";
import { useMemo } from "react";
import "./SettingsPage.scss";

interface SettingsPageProps {
  onOpenCompanies?: () => void;
  onOpenPrivacy?: () => void;
  onBack?: () => void;
}

export function SettingsPage({
  onOpenCompanies,
  onOpenPrivacy,
  onBack,
}: SettingsPageProps) {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const themeOptions = useMemo(
    () => [
      {
        value: "light",
        label: "Светлая",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle
              cx="12"
              cy="12"
              r="5"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
      {
        value: "dark",
        label: "Тёмная",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
    ],
    [],
  );

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
        {/* Тема */}
        <div className="settings-page__card">
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
              fill="url(#paint0_linear_theme)"
            />
            <path
              d="M16 7C20.9706 7 25 11.0294 25 16C25 20.9706 20.9706 25 16 25L15.5537 24.9893C15.5498 24.9891 15.5459 24.9885 15.542 24.9883C15.4963 24.986 15.4508 24.9805 15.4053 24.9775C15.3025 24.9707 15.1999 24.9644 15.0977 24.9541C13.602 24.8052 12.2146 24.2903 11.0254 23.5C11.0173 23.4947 11.009 23.4897 11.001 23.4844C10.8947 23.4132 10.7905 23.3392 10.6875 23.2637C10.6691 23.2502 10.6502 23.2373 10.6318 23.2236C10.5516 23.1639 10.4736 23.1014 10.3955 23.0391C10.3603 23.0111 10.3239 22.9846 10.2891 22.9561C10.2097 22.8908 10.1327 22.8228 10.0557 22.7549C9.91253 22.6289 9.77137 22.4999 9.63574 22.3643C9.49979 22.2283 9.37039 22.0869 9.24414 21.9434C9.17628 21.8663 9.1082 21.7894 9.04297 21.71C9.00042 21.6581 8.96026 21.6045 8.91895 21.5518C8.87082 21.4905 8.82194 21.4297 8.77539 21.3672C8.74796 21.3303 8.72215 21.2922 8.69531 21.2549C7.79486 20.0054 7.20557 18.5169 7.04492 16.9014C7.01492 16.6032 7 16.3024 7 16C7 15.6973 7.01485 15.3962 7.04492 15.0977C7.20574 13.4823 7.79478 11.9935 8.69531 10.7441C8.72215 10.7068 8.74796 10.6688 8.77539 10.6318C8.8351 10.5516 8.89767 10.4736 8.95996 10.3955C8.98797 10.3603 9.01441 10.3239 9.04297 10.2891C9.10821 10.2097 9.17627 10.1327 9.24414 10.0557C9.37024 9.91236 9.49996 9.77152 9.63574 9.63574C9.77351 9.49798 9.917 9.36705 10.0625 9.23926C10.1375 9.1733 10.2118 9.10644 10.2891 9.04297C10.326 9.01263 10.365 8.98479 10.4023 8.95508C10.4784 8.8946 10.5539 8.83343 10.6318 8.77539C10.6688 8.74796 10.7068 8.72215 10.7441 8.69531C10.829 8.63414 10.9139 8.5729 11.001 8.51465C11.0143 8.50572 11.0286 8.49811 11.042 8.48926C12.2275 7.70508 13.6088 7.19314 15.0977 7.04492C15.1999 7.03463 15.3025 7.02829 15.4053 7.02148C15.4508 7.01851 15.4963 7.01303 15.542 7.01074C15.6942 7.003 15.8469 7 16 7ZM16 23.5C20.1421 23.5 23.5 20.1421 23.5 16C23.5 11.8579 20.1421 8.5 16 8.5V23.5Z"
              fill="white"
            />
            <defs>
              <linearGradient
                id="paint0_linear_theme"
                x1="16"
                y1="0"
                x2="16"
                y2="32"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#7EADFF" />
                <stop offset="1" stopColor="#36A8DC" />
              </linearGradient>
            </defs>
          </svg>
          <div className="settings-page__card-content">
            <div className="settings-page__card-top">
              <span className="settings-page__card-name">Тема</span>
              <GlassSelect
                options={themeOptions}
                value={theme}
                onChange={(v) => {
                  if (v !== theme) toggleTheme();
                }}
              />
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
                width="8"
                height="14"
                viewBox="0 0 8 14"
                fill="none"
              >
                <path
                  d="M1 1L7 7L1 13"
                  stroke="currentColor"
                  stroke-opacity="0.3"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></path>
              </svg>
            </div>
          </div>
        </button>

        {/* Приватность */}
        <button
          className="settings-page__card"
          onClick={onOpenPrivacy}
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
              fill="url(#paint0_linear_1147_31537)"
            />
            <path
              d="M11.5826 25.2243C10.9037 25.2243 10.3886 25.0397 10.0372 24.6705C9.68586 24.3072 9.51017 23.7593 9.51017 23.0268V16.6933C9.51017 15.9667 9.68586 15.4218 10.0372 15.0586C10.3886 14.6953 10.9037 14.5136 11.5826 14.5136H19.9439C20.6228 14.5136 21.138 14.6953 21.4893 15.0586C21.8407 15.4218 22.0164 15.9667 22.0164 16.6933V23.0268C22.0164 23.7593 21.8407 24.3072 21.4893 24.6705C21.138 25.0397 20.6228 25.2243 19.9439 25.2243H11.5826ZM11.1449 15.264V12.4233C11.1449 11.3216 11.3593 10.4015 11.7881 9.66303C12.2228 8.91861 12.7916 8.35881 13.4943 7.98362C14.197 7.60843 14.9534 7.42084 15.7633 7.42084C16.5732 7.42084 17.3295 7.60843 18.0323 7.98362C18.735 8.35881 19.3007 8.91861 19.7295 9.66303C20.1643 10.4015 20.3816 11.3216 20.3816 12.4233V15.264H18.7112V12.2536C18.7112 11.5568 18.5742 10.9702 18.3003 10.4938C18.0323 10.0114 17.6749 9.64516 17.2283 9.39503C16.7816 9.14491 16.2933 9.01985 15.7633 9.01985C15.2333 9.01985 14.7449 9.14491 14.2983 9.39503C13.8516 9.64516 13.4943 10.0114 13.2263 10.4938C12.9583 10.9702 12.8243 11.5568 12.8243 12.2536V15.264H11.1449Z"
              fill="white"
            />
            <defs>
              <linearGradient
                id="paint0_linear_1147_31537"
                x1="16"
                y1="0"
                x2="16"
                y2="32"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#FFC574" />
                <stop offset="1" stopColor="#FF9400" />
              </linearGradient>
            </defs>
          </svg>
          <div className="settings-page__card-content">
            <div className="settings-page__card-top">
              <span className="settings-page__card-name">Приватность</span>
              <svg
                className="settings-page__card-arrow"
                width="8"
                height="14"
                viewBox="0 0 8 14"
                fill="none"
              >
                <path
                  d="M1 1L7 7L1 13"
                  stroke="currentColor"
                  stroke-opacity="0.3"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></path>
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
