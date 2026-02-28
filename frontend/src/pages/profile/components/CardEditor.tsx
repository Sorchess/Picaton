import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { User, ContactInfo } from "@/entities/user";
import { userApi } from "@/entities/user";
import type { BusinessCard } from "@/entities/business-card";
import { businessCardApi } from "@/entities/business-card";
import type { CompanyCardAssignment } from "@/entities/company";
import {
  IconButton,
  AvatarEmojiButton,
  Avatar,
  Input,
  Card,
  Button,
  GlassSelect,
  CardDivider,
} from "@/shared";
import { UnifiedBioEditor } from "./UnifiedBioEditor";
import { TagsEditor } from "@/features/tags-editor";
import { useI18n } from "@/shared/config";
import "./CardEditor.scss";

// Конфигурация типов контактов
const CONTACT_TYPES = [
  {
    type: "telegram",
    label: "Telegram",
    placeholder: "@username",
    icon: "telegram",
  },
  {
    type: "whatsapp",
    label: "WhatsApp",
    placeholder: "+7 999 123-45-67",
    icon: "whatsapp",
  },
  { type: "vk", label: "ВКонтакте", placeholder: "id123456", icon: "vk" },
  {
    type: "phone",
    label: "Телефон",
    placeholder: "+7 999 123-45-67",
    icon: "phone",
  },
  {
    type: "email",
    label: "Email",
    placeholder: "mail@example.com",
    icon: "email",
  },
  {
    type: "linkedin",
    label: "LinkedIn",
    placeholder: "username",
    icon: "linkedin",
  },
  { type: "github", label: "GitHub", placeholder: "username", icon: "github" },
  {
    type: "instagram",
    label: "Instagram",
    placeholder: "@username",
    icon: "instagram",
  },
  { type: "tiktok", label: "TikTok", placeholder: "@username", icon: "tiktok" },
  {
    type: "messenger",
    label: "Messenger",
    placeholder: "username",
    icon: "messenger",
  },
];

type EditStep = 1 | 2 | 3;

interface CardEditorProps {
  card: BusinessCard;
  user: User;
  usedByCompanies?: CompanyCardAssignment[];
  onBack: () => void;
  onCardUpdate: (card: BusinessCard) => void;
  onCardDelete: (cardId: string) => Promise<void>;
  onUserUpdate?: (user: User) => void;
}

export function CardEditor({
  card,
  user,
  usedByCompanies = [],
  onBack,
  onCardUpdate,
  onCardDelete,
  onUserUpdate,
}: CardEditorProps) {
  const { t } = useI18n();
  const [selectedCard, setSelectedCard] = useState<BusinessCard>(card);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Tag save state
  const [isApplyingTags, setIsApplyingTags] = useState(false);

  // Current bio text being edited (passed to TagsEditor for fallback suggestions)
  const [currentBioText, setCurrentBioText] = useState<string>(
    card.ai_generated_bio || card.bio || "",
  );

  // Tag editing state
  const [profileTags, setProfileTags] = useState<string[]>(
    card.search_tags || [],
  );

  // Contact form state
  const [showContactForm, setShowContactForm] = useState(false);
  const [newContactType, setNewContactType] = useState("telegram");
  const [newContactValue, setNewContactValue] = useState("");
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Emoji state
  const [isSavingEmojis, setIsSavingEmojis] = useState(false);

  // Avatar upload state
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Card settings state
  const [cardTitle, setCardTitle] = useState(card.title || "");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Role (position) editing state — per-card
  const [roleText, setRoleText] = useState(card.position || "");
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const roleInputRef = useRef<HTMLInputElement>(null);

  // Name editing state
  const [firstName, setFirstName] = useState(user.first_name || "");
  const [lastName, setLastName] = useState(user.last_name || "");
  const [username, setUsername] = useState(user.username || "");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingUsername, setIsSavingUsername] = useState(false);

  // Sync with prop changes
  useEffect(() => {
    setSelectedCard(card);
    setProfileTags(card.search_tags || []);
    setCardTitle(card.title || "");
    setRoleText(card.position || "");
    setFirstName(user.first_name || "");
    setLastName(user.last_name || "");
    setUsername(user.username || "");
  }, [card, user]);

  // Текущий шаг (теперь 3 шага: bio, tags, contacts)
  const currentStep = useMemo((): EditStep => {
    if (!selectedCard.ai_generated_bio) return 1;
    if (profileTags.length === 0) return 2;
    return 3;
  }, [selectedCard, profileTags]);

  // Обработка обновления карточки из UnifiedBioEditor
  const handleBioUpdate = useCallback(
    (updatedCard: BusinessCard) => {
      setSelectedCard(updatedCard);
      onCardUpdate(updatedCard);
    },
    [onCardUpdate],
  );

  // Изменение тегов
  const handleTagsChange = useCallback(
    async (newTags: string[]) => {
      setProfileTags(newTags);
      setIsApplyingTags(true);
      try {
        const updated = await businessCardApi.updateSearchTags(
          selectedCard.id,
          user.id,
          newTags,
        );
        setSelectedCard(updated);
        onCardUpdate(updated);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("cardEditor.saveTagsError"),
        );
      } finally {
        setIsApplyingTags(false);
      }
    },
    [user.id, selectedCard.id, onCardUpdate],
  );

  // Добавление контакта
  const handleAddContact = async () => {
    if (!newContactValue.trim()) return;
    setIsSavingContact(true);
    setError(null);
    try {
      const updated = await businessCardApi.addContact(
        selectedCard.id,
        user.id,
        {
          type: newContactType,
          value: newContactValue.trim(),
          is_visible: true,
        },
      );
      setSelectedCard(updated);
      onCardUpdate(updated);
      setNewContactValue("");
      setShowContactForm(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("cardEditor.saveContactError"),
      );
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleDeleteContact = async (contact: ContactInfo) => {
    if (
      !confirm(t("cardEditor.deleteContactConfirm", { value: contact.value }))
    )
      return;
    try {
      const updated = await businessCardApi.deleteContact(
        selectedCard.id,
        user.id,
        contact.type,
        contact.value,
      );
      setSelectedCard(updated);
      onCardUpdate(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("cardEditor.savingError"),
      );
    }
  };

  // Обработка изменения эмодзи
  const handleEmojisChange = useCallback(
    async (newEmojis: string[]) => {
      setIsSavingEmojis(true);
      try {
        const updated = await businessCardApi.updateEmojis(
          selectedCard.id,
          user.id,
          newEmojis,
        );
        setSelectedCard(updated);
        onCardUpdate(updated);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("cardEditor.saveEmojiError"),
        );
      } finally {
        setIsSavingEmojis(false);
      }
    },
    [user.id, selectedCard.id, onCardUpdate],
  );

  // Save card settings (title, display_name, avatar)
  const handleSaveSettings = useCallback(
    async (updates: {
      title?: string;
      display_name?: string;
      avatar_url?: string | null;
    }) => {
      setIsSavingSettings(true);
      try {
        const updated = await businessCardApi.update(
          selectedCard.id,
          user.id,
          updates,
        );
        setSelectedCard(updated);
        onCardUpdate(updated);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("cardEditor.saveSettingsError"),
        );
      } finally {
        setIsSavingSettings(false);
      }
    },
    [user.id, selectedCard.id, onCardUpdate],
  );

  // Debounced save for title
  const handleTitleChange = useCallback((value: string) => {
    setCardTitle(value);
  }, []);

  const handleTitleBlur = useCallback(() => {
    if (cardTitle !== selectedCard.title) {
      handleSaveSettings({ title: cardTitle });
    }
  }, [cardTitle, selectedCard.title, handleSaveSettings]);

  // Role (position) handlers
  const handleEditRoleClick = useCallback(() => {
    setIsEditingRole(true);
    setTimeout(() => roleInputRef.current?.focus(), 0);
  }, []);

  const handleSaveRole = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (trimmed === (selectedCard.position || "")) return;
      setIsSavingRole(true);
      try {
        const updated = await businessCardApi.update(selectedCard.id, user.id, {
          position: trimmed || null,
        });
        setSelectedCard(updated);
        onCardUpdate(updated);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("cardEditor.saveRoleError"),
        );
      } finally {
        setIsSavingRole(false);
      }
    },
    [selectedCard.id, selectedCard.position, user.id, onCardUpdate],
  );

  const handleRoleBlur = useCallback(() => {
    handleSaveRole(roleText);
    setIsEditingRole(false);
  }, [roleText, handleSaveRole]);

  const handleRoleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      } else if (e.key === "Escape") {
        setRoleText(selectedCard.position || "");
        setIsEditingRole(false);
      }
    },
    [selectedCard.position],
  );

  // Name save handlers
  const handleSaveName = useCallback(
    async (updates: { first_name?: string; last_name?: string }) => {
      setIsSavingName(true);
      try {
        const updatedUser = await userApi.update(user.id, updates);
        onUserUpdate?.(updatedUser);

        // Обновляем display_name на визитке, чтобы имя отображалось на профиле
        const newFullName = [
          updates.first_name ?? user.first_name,
          updates.last_name ?? user.last_name,
        ]
          .filter(Boolean)
          .join(" ");
        if (newFullName) {
          const updatedCard = await businessCardApi.update(
            selectedCard.id,
            user.id,
            { display_name: newFullName },
          );
          setSelectedCard(updatedCard);
          onCardUpdate(updatedCard);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("cardEditor.saveNameError"),
        );
      } finally {
        setIsSavingName(false);
      }
    },
    [
      user.id,
      user.first_name,
      user.last_name,
      selectedCard.id,
      onUserUpdate,
      onCardUpdate,
    ],
  );

  const handleFirstNameBlur = useCallback(() => {
    if (firstName.trim() !== (user.first_name || "")) {
      handleSaveName({ first_name: firstName.trim() });
    }
  }, [firstName, user.first_name, handleSaveName]);

  const handleLastNameBlur = useCallback(() => {
    if (lastName.trim() !== (user.last_name || "")) {
      handleSaveName({ last_name: lastName.trim() });
    }
  }, [lastName, user.last_name, handleSaveName]);

  // Username save handler
  const handleUsernameBlur = useCallback(async () => {
    const trimmed = username.trim().replace(/^@/, "");
    if (trimmed === (user.username || "")) return;
    setIsSavingUsername(true);
    try {
      const updatedUser = await userApi.update(user.id, {
        username: trimmed || null,
      });
      onUserUpdate?.(updatedUser);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("cardEditor.saveUsernameError"),
      );
    } finally {
      setIsSavingUsername(false);
    }
  }, [username, user.id, user.username, onUserUpdate]);

  // Avatar upload
  const handleAvatarUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        setError(t("cardEditor.supportedFormats"));
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError(t("cardEditor.maxFileSize"));
        return;
      }

      setIsUploadingAvatar(true);
      setError(null);
      try {
        const result = await businessCardApi.uploadAvatar(
          selectedCard.id,
          user.id,
          file,
        );
        const updated = {
          ...selectedCard,
          avatar_url: result.avatar_url,
        };
        setSelectedCard(updated);
        onCardUpdate(updated);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("cardEditor.avatarUploadError"),
        );
      } finally {
        setIsUploadingAvatar(false);
        // Reset input so the same file can be selected again
        if (avatarInputRef.current) {
          avatarInputRef.current.value = "";
        }
      }
    },
    [selectedCard, user.id, onCardUpdate],
  );

  const localizedContactTypes = useMemo(
    () =>
      CONTACT_TYPES.map((ct) => ({
        ...ct,
        label:
          ct.type === "vk"
            ? t("cardEditor.vkontakte")
            : ct.type === "phone"
              ? t("cardEditor.phone")
              : ct.label,
      })),
    [t],
  );

  const getContactLabel = (type: string) => {
    return (
      localizedContactTypes.find((ct) => ct.type === type.toLowerCase())
        ?.label || type
    );
  };

  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  };

  // Формируем отображаемое имя (из визитки или профиля)
  const userFullName = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ");
  const cardDisplayName = selectedCard.display_name || userFullName;

  // Аватар визитки (из визитки или профиля)
  const cardAvatarUrl = selectedCard.avatar_url || user.avatar_url;

  return (
    <div className="card-editor">
      {/* Top Bar */}
      <div className="card-editor__top-bar">
        <IconButton onClick={onBack} aria-label={t("common.back")}>
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

        <IconButton
          variant="danger"
          onClick={() => setShowDeleteConfirm(true)}
          aria-label={
            selectedCard.is_primary
              ? t("cardEditor.clearCard")
              : t("cardEditor.deleteCard")
          }
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" />
          </svg>
        </IconButton>
      </div>

      {/* Toast */}
      {error && (
        <div className="card-editor__toast" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {/* Hero Section */}
      <div className="card-editor__hero">
        <div className="card-editor__emojis">
          {selectedCard?.emojis.map((emoji, index) => (
            <span
              key={index}
              className={`profile-hero__emoji profile-hero__emoji--${index + 1}`}
            >
              <span className="profile-hero__emoji-blur">{emoji}</span>
              <span className="profile-hero__emoji-main">{emoji}</span>
            </span>
          ))}
        </div>
        <div className="card-editor__avatar">
          <Avatar
            src={cardAvatarUrl || undefined}
            initials={getInitials(cardDisplayName)}
            size="lg"
            alt={cardDisplayName}
            gradientColors={user.avatar_gradient}
          />
          <AvatarEmojiButton
            selectedEmojis={selectedCard.emojis || []}
            onChange={handleEmojisChange}
            disabled={isSavingEmojis}
            isSaving={isSavingEmojis}
          />
        </div>

        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleAvatarUpload}
          className="card-editor__avatar-input"
          aria-hidden="true"
        />
        <button
          type="button"
          className="card-editor__avatar-btn"
          onClick={() => avatarInputRef.current?.click()}
          disabled={isUploadingAvatar}
        >
          {isUploadingAvatar ? (
            <>
              <span className="card-editor__spinner" /> {t("common.loading")}
            </>
          ) : (
            t("cardEditor.selectAvatar")
          )}
        </button>

        <div className="card-editor__info">
          <div className="card-editor__roles">
            {isEditingRole ? (
              <Button
                className="card-editor__role-chip card-editor__role-chip--editing"
                variant="liquid"
                size="sm"
              >
                <input
                  ref={roleInputRef}
                  type="text"
                  className="card-editor__role-input"
                  value={roleText}
                  onChange={(e) => setRoleText(e.target.value)}
                  onBlur={handleRoleBlur}
                  onKeyDown={handleRoleKeyDown}
                  placeholder={t("cardEditor.rolePlaceholder")}
                  maxLength={50}
                />
                {isSavingRole && <span className="card-editor__spinner" />}
              </Button>
            ) : (
              <button
                type="button"
                className="card-editor__role-chip"
                onClick={handleEditRoleClick}
              >
                <Button
                  variant="liquid"
                  size="sm"
                  className="card-editor__role-chip-button"
                >
                  <span className="card-editor__role-chip-text">
                    {selectedCard.position || t("common.user")}
                  </span>
                </Button>
                <IconButton
                  className="card-editor__role-chip-icon-btn"
                  aria-label={t("cardEditor.editRole")}
                >
                  <svg
                    className="card-editor__role-chip-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                </IconButton>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="card-editor__content">
        {/* Card Name Section */}
        <Card className="card-editor__card">
          <div className="card-editor__section-header">
            <h2 className="card-editor__section-title">
              {t("cardEditor.cardTitle")}
            </h2>
            {isSavingSettings && (
              <span className="card-editor__section-action">
                <span className="card-editor__spinner" /> {t("common.saving")}
              </span>
            )}
          </div>
          <Input
            type="text"
            variant="transparent"
            className="card-editor__input"
            value={cardTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder={t("cardEditor.cardTitlePlaceholder")}
            maxLength={50}
          />
        </Card>

        {/* Name Section */}
        <Card className="card-editor__card">
          <div className="card-editor__section-header">
            <h2 className="card-editor__section-title">
              {t("cardEditor.firstName")}
            </h2>
            {isSavingName && (
              <span className="card-editor__section-action">
                <span className="card-editor__spinner" /> {t("common.saving")}
              </span>
            )}
          </div>
          <Input
            type="text"
            variant="transparent"
            className="card-editor__input"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            onBlur={handleFirstNameBlur}
            placeholder={t("cardEditor.firstName")}
            maxLength={50}
          />
          <CardDivider />
          <div className="card-editor__section-header">
            <h2 className="card-editor__section-title">
              {t("cardEditor.lastName")}
            </h2>
          </div>
          <Input
            type="text"
            variant="transparent"
            className="card-editor__input"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            onBlur={handleLastNameBlur}
            placeholder={t("cardEditor.lastName")}
            maxLength={50}
          />
        </Card>

        {/* User id */}
        <Card className="card-editor__card">
          <div className="card-editor__section-header">
            <h2 className="card-editor__section-title">
              {t("cardEditor.userId")}
            </h2>
            {isSavingUsername && (
              <span className="card-editor__section-action">
                <span className="card-editor__spinner" /> {t("common.saving")}
              </span>
            )}
          </div>
          <div className="card-editor__username-field">
            <span className="card-editor__username-prefix">@</span>
            <Input
              type="text"
              variant="transparent"
              className="card-editor__input card-editor__input--username"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/^@/, ""))}
              onBlur={handleUsernameBlur}
              placeholder="username"
              maxLength={50}
            />
          </div>
        </Card>

        {/* Bio Section */}
        <Card className="card-editor__card">
          <UnifiedBioEditor
            card={selectedCard}
            userId={user.id}
            isActive={currentStep === 1}
            onCardUpdate={handleBioUpdate}
            onError={setError}
            onBioTextChange={setCurrentBioText}
          />
        </Card>

        {/* Tags Section */}
        <Card className="card-editor__card">
          <div className="card-editor__section-header">
            <h2 className="card-editor__section-title">
              {t("cardEditor.skillsAndTags")}
            </h2>
          </div>

          <TagsEditor
            card={selectedCard}
            userId={user.id}
            value={profileTags}
            onChange={handleTagsChange}
            placeholder={t("cardEditor.addTag")}
            bioText={currentBioText}
            disabled={isApplyingTags}
          />
          {isApplyingTags && (
            <span className="card-editor__section-action">
              {t("common.saving")}
            </span>
          )}
        </Card>

        {/* Contacts Section */}
        <Card className="card-editor__card">
          <div className="card-editor__section-header">
            <h2 className="card-editor__section-title">
              {t("cardEditor.contacts")}
            </h2>
          </div>

          {selectedCard.contacts && selectedCard.contacts.length > 0 && (
            <div className="card-editor__contacts-list">
              {selectedCard.contacts.map((contact, idx) => (
                <div key={idx} className="card-editor__contact-item">
                  <span
                    className={`card-editor__contact-icon card-editor__contact-icon--${contact.type.toLowerCase()}`}
                  />
                  <div className="card-editor__contact-info">
                    <span className="card-editor__contact-type">
                      {getContactLabel(contact.type)}
                    </span>
                    <span className="card-editor__contact-value">
                      {contact.value}
                    </span>
                  </div>
                  <button
                    className="card-editor__contact-delete"
                    onClick={() => handleDeleteContact(contact as ContactInfo)}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {showContactForm ? (
            <div className="card-editor__contact-form">
              <div className="card-editor__contact-form-row">
                <GlassSelect
                  options={localizedContactTypes.map((ct) => ({
                    value: ct.type,
                    label: ct.label,
                  }))}
                  value={newContactType}
                  onChange={(v) => setNewContactType(v)}
                />
                <Input
                  type="text"
                  className="card-editor__input"
                  value={newContactValue}
                  onChange={(e) => setNewContactValue(e.target.value)}
                  placeholder={
                    localizedContactTypes.find(
                      (ct) => ct.type === newContactType,
                    )?.placeholder
                  }
                />
              </div>
              <div className="card-editor__contact-form-actions">
                <button
                  className="card-editor__btn card-editor__btn--secondary"
                  onClick={() => setShowContactForm(false)}
                >
                  {t("common.cancel")}
                </button>
                <button
                  className="card-editor__btn card-editor__btn--primary"
                  onClick={handleAddContact}
                  disabled={!newContactValue.trim() || isSavingContact}
                >
                  {isSavingContact ? (
                    <>
                      <span className="card-editor__spinner" />{" "}
                      {t("common.adding")}
                    </>
                  ) : (
                    t("common.add")
                  )}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="card-editor__add-contact"
              onClick={() => setShowContactForm(true)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t("cardEditor.addContact")}
            </button>
          )}
        </Card>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div
          className="card-editor__modal-overlay"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="card-editor__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-editor__modal-icon">🗑️</div>
            <h3 className="card-editor__modal-title">
              {selectedCard.is_primary
                ? t("cardEditor.clearCardConfirm")
                : t("cardEditor.deleteCardConfirm")}
            </h3>
            <p className="card-editor__modal-text">
              {selectedCard.is_primary
                ? t("cardEditor.clearCardWarning", {
                    title: selectedCard.title || "",
                  })
                : t("cardEditor.deleteCardWarning", {
                    title: selectedCard.title || "",
                  })}
            </p>
            {usedByCompanies.length > 0 && (
              <div className="card-editor__modal-warning">
                <span className="card-editor__modal-warning-icon">⚠️</span>
                <div className="card-editor__modal-warning-content">
                  {t("cardEditor.companyWarning")}
                  <ul className="card-editor__modal-warning-list">
                    {usedByCompanies.map((c) => (
                      <li key={c.company_id}>{c.company_name}</li>
                    ))}
                  </ul>
                  {t("cardEditor.afterDeleteCompanyWarning")}
                </div>
              </div>
            )}
            <div className="card-editor__modal-actions">
              <button
                className="card-editor__btn card-editor__btn--secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                {t("common.cancel")}
              </button>
              <button
                className="card-editor__btn card-editor__btn--danger"
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await onCardDelete(selectedCard.id);
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : t("common.error"),
                    );
                    setIsDeleting(false);
                    setShowDeleteConfirm(false);
                  }
                }}
                disabled={isDeleting}
              >
                {isDeleting
                  ? selectedCard.is_primary
                    ? t("common.clearing")
                    : t("common.deleting")
                  : selectedCard.is_primary
                    ? t("common.clear")
                    : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
