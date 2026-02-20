import { IconButton, GlassSelect } from "@/shared";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/features/auth";
import { userApi } from "@/entities/user";
import "./PrivacyPage.scss";

interface PrivacyPageProps {
  onBack?: () => void;
}

const messagingOptions = [
  { value: "all", label: "Все" },
  { value: "contacts", label: "Мои контакты" },
  { value: "contacts_of_contacts", label: "Контакты моих контактов" },
];

const profileVisibilityOptions = [
  { value: "all", label: "Все" },
  { value: "contacts", label: "Мои контакты" },
  { value: "contacts_of_contacts", label: "Контакты моих контактов" },
];

const companyInviteOptions = [
  { value: "all", label: "Все" },
  { value: "contacts", label: "Мои контакты" },
  { value: "contacts_of_contacts", label: "Контакты моих контактов" },
  { value: "nobody", label: "Никто" },
];

export function PrivacyPage({ onBack }: PrivacyPageProps) {
  const { user } = useAuth();
  const [whoCanMessage, setWhoCanMessage] = useState("all");
  const [whoCanSeeProfile, setWhoCanSeeProfile] = useState("all");
  const [whoCanInvite, setWhoCanInvite] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  // Загрузить текущие настройки
  useEffect(() => {
    if (!user) return;
    userApi
      .getPrivacySettings(user.id)
      .then((settings) => {
        setWhoCanMessage(settings.who_can_message);
        setWhoCanSeeProfile(settings.who_can_see_profile);
        setWhoCanInvite(settings.who_can_invite);
      })
      .finally(() => setIsLoading(false));
  }, [user]);

  const updateSetting = useCallback(
    (field: string, value: string) => {
      if (!user) return;
      userApi.updatePrivacySettings(user.id, { [field]: value });
    },
    [user],
  );

  const handleMessageChange = (v: string) => {
    setWhoCanMessage(v);
    updateSetting("who_can_message", v);
  };

  const handleProfileChange = (v: string) => {
    setWhoCanSeeProfile(v);
    updateSetting("who_can_see_profile", v);
  };

  const handleInviteChange = (v: string) => {
    setWhoCanInvite(v);
    updateSetting("who_can_invite", v);
  };

  if (isLoading) {
    return (
      <div className="privacy-page">
        <header className="privacy-page__header">
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
          <div className="privacy-page__title-container">
            <h1 className="privacy-page__title">Приватность</h1>
          </div>
          <div style={{ width: 36 }} />
        </header>
      </div>
    );
  }

  return (
    <div className="privacy-page">
      {/* Заголовок */}
      <header className="privacy-page__header">
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
        <div className="privacy-page__title-container">
          <h1 className="privacy-page__title">Приватность</h1>
        </div>
        <div style={{ width: 36 }} />
      </header>

      {/* Настройки приватности */}
      <div className="privacy-page__list">
        {/* Кто может писать мне */}
        <div className="privacy-page__card">
          <div className="privacy-page__card-content">
            <div className="privacy-page__card-top">
              <span className="privacy-page__card-name">
                Кто может писать мне
              </span>
              <GlassSelect
                options={messagingOptions}
                value={whoCanMessage}
                onChange={handleMessageChange}
              />
            </div>
          </div>
        </div>

        {/* Кто видит мой профиль */}
        <div className="privacy-page__card">
          <div className="privacy-page__card-content">
            <div className="privacy-page__card-top">
              <span className="privacy-page__card-name">
                Кто видит мой профиль
              </span>
              <GlassSelect
                options={profileVisibilityOptions}
                value={whoCanSeeProfile}
                onChange={handleProfileChange}
              />
            </div>
          </div>
        </div>

        {/* Кто может приглашать в компании */}
        <div className="privacy-page__card">
          <div className="privacy-page__card-content">
            <div className="privacy-page__card-top">
              <span className="privacy-page__card-name">
                Приглашения в компании
              </span>
              <GlassSelect
                options={companyInviteOptions}
                value={whoCanInvite}
                onChange={handleInviteChange}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
