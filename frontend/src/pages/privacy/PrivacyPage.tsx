import { IconButton, GlassSelect } from "@/shared";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/features/auth";
import { userApi } from "@/entities/user";
import { useI18n } from "@/shared/config";
import "./PrivacyPage.scss";

interface PrivacyPageProps {
  onBack?: () => void;
}

export function PrivacyPage({ onBack }: PrivacyPageProps) {
  const { user } = useAuth();
  const { t } = useI18n();

  const messagingOptions = useMemo(
    () => [
      { value: "all", label: t("privacy.all") },
      { value: "contacts", label: t("privacy.contacts") },
      { value: "contacts_of_contacts", label: t("privacy.contactsOfContacts") },
      { value: "company_colleagues", label: t("privacy.contactsColleagues") },
    ],
    [t],
  );

  const profileVisibilityOptions = useMemo(
    () => [
      { value: "all", label: t("privacy.all") },
      { value: "contacts", label: t("privacy.contacts") },
      { value: "contacts_of_contacts", label: t("privacy.contactsOfContacts") },
      { value: "company_colleagues", label: t("privacy.contactsColleagues") },
      { value: "nobody", label: t("privacy.nobody") },
    ],
    [t],
  );

  const companyInviteOptions = useMemo(
    () => [
      { value: "all", label: t("privacy.all") },
      { value: "contacts", label: t("privacy.contacts") },
      { value: "contacts_of_contacts", label: t("privacy.contactsOfContacts") },
      { value: "company_colleagues", label: t("privacy.contactsColleagues") },
      { value: "nobody", label: t("privacy.nobody") },
    ],
    [t],
  );
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
          <IconButton aria-label={t("common.back")} onClick={onBack}>
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
            <h1 className="privacy-page__title">{t("privacy.title")}</h1>
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
        <IconButton aria-label={t("common.back")} onClick={onBack}>
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
          <h1 className="privacy-page__title">{t("privacy.title")}</h1>
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
                {t("privacy.whoCanMessage")}
              </span>
              <GlassSelect
                options={messagingOptions}
                value={whoCanMessage}
                onChange={handleMessageChange}
              />
            </div>
          </div>
        </div>

        {/* Кто видит мой профиль в поиске */}
        <div className="privacy-page__card">
          <div className="privacy-page__card-content">
            <div className="privacy-page__card-top">
              <span className="privacy-page__card-name">
                {t("privacy.whoCanSeeProfile")}
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
                {t("privacy.whoCanInvite")}
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
