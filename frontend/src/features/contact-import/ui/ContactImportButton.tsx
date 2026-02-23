import { useState, useEffect } from "react";
import { TelegramSyncModal } from "./TelegramSyncModal";
import { authApi } from "@/features/auth";
import type { TelegramFoundContact } from "@/features/auth/model/types";
import { useI18n } from "@/shared/config";
import "./ContactImportButton.scss";

interface ContactImportButtonProps {
  onSyncComplete?: (contacts: TelegramFoundContact[]) => void;
  disabled?: boolean;
}

export function ContactImportButton({
  onSyncComplete,
  disabled = false,
}: ContactImportButtonProps) {
  const { t } = useI18n();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await authApi.getTelegramConfig();
        setIsEnabled(config.enabled);
      } catch (error) {
        console.error("Failed to load Telegram config:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  const handleSyncComplete = (contacts: TelegramFoundContact[]) => {
    onSyncComplete?.(contacts);
  };

  if (isLoading) {
    return (
      <button
        className="contact-import__btn contact-import__btn--loading"
        disabled
      >
        <div className="contact-import__spinner" />
      </button>
    );
  }

  if (!isEnabled) {
    return (
      <button
        className="contact-import__btn contact-import__btn--disabled"
        disabled
        title={t("contactImport.syncUnavailable")}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="18" y1="8" x2="23" y2="13" />
          <line x1="23" y1="8" x2="18" y2="13" />
        </svg>
        {t("contactImport.sync")}
      </button>
    );
  }

  return (
    <>
      <button
        className="contact-import__btn"
        onClick={() => setIsModalOpen(true)}
        disabled={disabled}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
        {t("contactImport.sync")}
      </button>

      <TelegramSyncModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSyncComplete={handleSyncComplete}
      />
    </>
  );
}
