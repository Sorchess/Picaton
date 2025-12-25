import { useState } from "react";
import { PhoneInputModal } from "./PhoneInputModal";
import type { PhoneContact, ImportStats, HashedContact, ContactSyncResult } from "../model/types";
import "./ContactImportButton.scss";

interface ContactImportButtonProps {
  onImport: (contacts: PhoneContact[]) => Promise<ImportStats>;
  onSync?: (contacts: HashedContact[]) => Promise<ContactSyncResult>;
  onImported?: () => void;
  disabled?: boolean;
}

export function ContactImportButton({
  onImport,
  onSync,
  onImported,
  disabled = false,
}: ContactImportButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // If sync is available, use the new enterprise approach
  if (onSync) {
    return (
      <>
        <button
          className="contact-import__btn"
          onClick={() => setIsModalOpen(true)}
          disabled={disabled}
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
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Синхронизация
        </button>

        <PhoneInputModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSync={onSync}
          onSyncComplete={onImported}
        />
      </>
    );
  }

  // Fallback: show message that sync is not configured
  return (
    <button
      className="contact-import__btn contact-import__btn--disabled"
      disabled
      title="Синхронизация контактов недоступна"
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
      Синхронизация
    </button>
  );
}
