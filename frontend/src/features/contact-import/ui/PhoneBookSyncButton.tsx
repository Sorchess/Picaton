import { useState, useCallback } from "react";
import { useAuth } from "@/features/auth";
import { userApi } from "@/entities/user";
import { hashPhones, normalizePhone } from "../lib/hashPhone";
import type { HashedContact } from "../model/types";
import { useI18n } from "@/shared/config";
import { Modal, Loader, Button } from "@/shared";
import "./PhoneBookSyncButton.scss";

/**
 * Contact Picker API type declarations.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Contact_Picker_API
 */
interface ContactAddress {
  city?: string;
  country?: string;
  postalCode?: string;
  region?: string;
  streetAddress?: string;
}

interface ContactInfo {
  name?: string[];
  email?: string[];
  tel?: string[];
  address?: ContactAddress[];
  icon?: Blob[];
}

interface ContactsManager {
  select(
    properties: string[],
    options?: { multiple?: boolean },
  ): Promise<ContactInfo[]>;
  getProperties(): Promise<string[]>;
}

declare global {
  interface Navigator {
    contacts?: ContactsManager;
  }
}

interface PhoneBookSyncButtonProps {
  onSyncComplete?: () => void;
  disabled?: boolean;
}

interface SyncResultData {
  found: Array<{
    hash: string;
    original_name: string;
    user: { id: string; name: string; avatar_url?: string };
  }>;
  found_count: number;
  pending_count: number;
  total_picked: number;
}

export function PhoneBookSyncButton({
  onSyncComplete,
  disabled = false,
}: PhoneBookSyncButtonProps) {
  const { t } = useI18n();
  const { user: authUser } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<SyncResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [savedUserIds, setSavedUserIds] = useState<Set<string>>(new Set());
  const [showInstructions, setShowInstructions] = useState(false);

  const isSupported =
    typeof navigator !== "undefined" &&
    "contacts" in navigator &&
    !!navigator.contacts;

  const handlePickContacts = useCallback(async () => {
    if (!isSupported || !navigator.contacts) {
      setShowInstructions(true);
      return;
    }

    if (!authUser) return;

    setError(null);
    setResult(null);
    setIsProcessing(true);

    try {
      // Request access to the phone book
      const contacts = await navigator.contacts.select(
        ["name", "tel", "email"],
        {
          multiple: true,
        },
      );

      if (!contacts || contacts.length === 0) {
        setIsProcessing(false);
        return;
      }

      // Extract phone contacts with names
      const phoneContacts: Array<{ name: string; phone: string }> = [];
      const importContacts: Array<{
        name: string;
        phone?: string;
        email?: string;
      }> = [];

      for (const contact of contacts) {
        const name = contact.name?.[0] || t("phoneBookSync.unknownContact");
        const phones = contact.tel || [];
        const emails = contact.email || [];

        // Collect for phone-hash sync
        for (const phone of phones) {
          const normalized = normalizePhone(phone);
          if (normalized) {
            phoneContacts.push({ name, phone: normalized });
          }
        }

        // Collect for import (first phone and email)
        importContacts.push({
          name,
          phone: phones[0] || undefined,
          email: emails[0] || undefined,
        });
      }

      // Step 1: Hash phones and sync to find registered users
      if (phoneContacts.length > 0) {
        const hashed: HashedContact[] = await hashPhones(
          phoneContacts.map((c) => ({ name: c.name, phone: c.phone })),
        );

        if (hashed.length > 0) {
          const syncResult = await userApi.syncContacts(authUser.id, hashed);
          setResult({
            ...syncResult,
            total_picked: contacts.length,
          });
        } else {
          setResult({
            found: [],
            found_count: 0,
            pending_count: contacts.length,
            total_picked: contacts.length,
          });
        }
      } else {
        setResult({
          found: [],
          found_count: 0,
          pending_count: contacts.length,
          total_picked: contacts.length,
        });
      }

      // Step 2: Import all contacts (name/phone/email) into user's contact list
      if (importContacts.length > 0) {
        try {
          await userApi.importContacts(authUser.id, importContacts);
        } catch (importErr) {
          console.warn("Contact import partial failure:", importErr);
        }
      }

      onSyncComplete?.();
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError(t("phoneBookSync.permissionDenied"));
      } else if (err instanceof DOMException && err.name === "AbortError") {
        // User cancelled picker — not an error
      } else {
        setError(
          err instanceof Error ? err.message : t("phoneBookSync.syncError"),
        );
      }
    } finally {
      setIsProcessing(false);
    }
  }, [authUser, isSupported, onSyncComplete, t]);

  const handleSaveUser = useCallback(
    async (userId: string) => {
      if (!authUser) return;
      setSavingUserId(userId);
      try {
        await userApi.saveContact(authUser.id, userId);
        setSavedUserIds((prev) => new Set(prev).add(userId));
      } catch (err) {
        console.error("Failed to save contact:", err);
      } finally {
        setSavingUserId(null);
      }
    },
    [authUser],
  );

  const handleClose = useCallback(() => {
    setResult(null);
    setError(null);
    setSavedUserIds(new Set());
  }, []);

  return (
    <>
      <Button
        className="phonebook-sync__btn"
        onClick={handlePickContacts}
        disabled={disabled || isProcessing}
        variant="secondary"
      >
        {isProcessing ? (
          <div className="phonebook-sync__spinner" />
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        )}
        {t("phoneBookSync.syncContacts")}
      </Button>

      {error && (
        <div className="phonebook-sync__error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <Modal
        isOpen={!!result}
        onClose={handleClose}
        title={t("phoneBookSync.resultsTitle")}
      >
        {result && (
          <div className="phonebook-sync__results">
            <div className="phonebook-sync__stats">
              <div className="phonebook-sync__stat">
                <span className="phonebook-sync__stat-value">
                  {result.total_picked}
                </span>
                <span className="phonebook-sync__stat-label">
                  {t("phoneBookSync.contactsPicked")}
                </span>
              </div>
              {result.found_count > 0 && (
                <div className="phonebook-sync__stat phonebook-sync__stat--success">
                  <span className="phonebook-sync__stat-value">
                    {result.found_count}
                  </span>
                  <span className="phonebook-sync__stat-label">
                    {t("phoneBookSync.foundInPicaton")}
                  </span>
                </div>
              )}
              {result.pending_count > 0 && (
                <div className="phonebook-sync__stat phonebook-sync__stat--pending">
                  <span className="phonebook-sync__stat-value">
                    {result.pending_count}
                  </span>
                  <span className="phonebook-sync__stat-label">
                    {t("phoneBookSync.notRegistered")}
                  </span>
                </div>
              )}
            </div>

            {result.found.length > 0 && (
              <div className="phonebook-sync__found">
                <h4 className="phonebook-sync__found-title">
                  {t("phoneBookSync.foundUsers")}
                </h4>
                <div className="phonebook-sync__found-list">
                  {result.found.map((item) => (
                    <div
                      key={item.user.id}
                      className="phonebook-sync__found-item"
                    >
                      <div className="phonebook-sync__found-avatar">
                        {item.user.avatar_url ? (
                          <img src={item.user.avatar_url} alt="" />
                        ) : (
                          <span>
                            {item.user.name
                              .split(" ")
                              .map((w) => w[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="phonebook-sync__found-info">
                        <span className="phonebook-sync__found-name">
                          {item.user.name}
                        </span>
                        <span className="phonebook-sync__found-original">
                          {item.original_name}
                        </span>
                      </div>
                      <button
                        className={`phonebook-sync__found-btn ${savedUserIds.has(item.user.id) ? "phonebook-sync__found-btn--saved" : ""}`}
                        onClick={() => handleSaveUser(item.user.id)}
                        disabled={
                          savingUserId === item.user.id ||
                          savedUserIds.has(item.user.id)
                        }
                      >
                        {savingUserId === item.user.id ? (
                          <Loader />
                        ) : savedUserIds.has(item.user.id) ? (
                          <>
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {t("phoneBookSync.saved")}
                          </>
                        ) : (
                          <>
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                            {t("phoneBookSync.saveContact")}
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.found.length === 0 && (
              <div className="phonebook-sync__empty">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <p>{t("phoneBookSync.noUsersFound")}</p>
              </div>
            )}

            <div className="phonebook-sync__modal-actions">
              <Button variant="primary" fullWidth onClick={handleClose}>
                {t("common.close")}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Instructions modal for unsupported browsers */}
      <Modal
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
        title={t("phoneBookSync.syncContacts")}
      >
        <div className="phonebook-sync__instructions">
          <div className="phonebook-sync__instructions-icon">📱</div>
          <p className="phonebook-sync__instructions-title">
            {t("phoneBookSync.unsupportedTitle")}
          </p>
          <p className="phonebook-sync__instructions-text">
            {t("phoneBookSync.unsupportedText")}
          </p>
          <div className="phonebook-sync__instructions-steps">
            <div className="phonebook-sync__instructions-step">
              <span className="phonebook-sync__instructions-step-num">1</span>
              <span>{t("phoneBookSync.instructionStep1")}</span>
            </div>
            <div className="phonebook-sync__instructions-step">
              <span className="phonebook-sync__instructions-step-num">2</span>
              <span>{t("phoneBookSync.instructionStep2")}</span>
            </div>
            <div className="phonebook-sync__instructions-step">
              <span className="phonebook-sync__instructions-step-num">3</span>
              <span>{t("phoneBookSync.instructionStep3")}</span>
            </div>
          </div>
          <Button
            variant="primary"
            fullWidth
            onClick={() => setShowInstructions(false)}
          >
            {t("common.understood")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
