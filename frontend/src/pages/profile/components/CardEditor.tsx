import { useState, useEffect, useCallback, useMemo } from "react";
import type { User, ContactInfo } from "@/entities/user";
import type { BusinessCard } from "@/entities/business-card";
import { businessCardApi } from "@/entities/business-card";
import type { CompanyCardAssignment } from "@/entities/company";
import { TagInput } from "@/shared";
import { UnifiedBioEditor } from "./UnifiedBioEditor";
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

interface SuggestedTag {
  name: string;
  category: string;
  confidence: number;
  reason: string;
}

type EditStep = 1 | 2 | 3;

interface CardEditorProps {
  card: BusinessCard;
  user: User;
  usedByCompanies?: CompanyCardAssignment[];
  onBack: () => void;
  onCardUpdate: (card: BusinessCard) => void;
  onCardDelete: (cardId: string) => Promise<void>;
}

export function CardEditor({
  card,
  user,
  usedByCompanies = [],
  onBack,
  onCardUpdate,
  onCardDelete,
}: CardEditorProps) {
  const [selectedCard, setSelectedCard] = useState<BusinessCard>(card);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // AI states
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [aiTagSuggestions, setAiTagSuggestions] = useState<string[]>([]);
  const [isApplyingTags, setIsApplyingTags] = useState(false);
  const [hasFetchedSuggestions, setHasFetchedSuggestions] = useState(false);

  // Tag editing state
  const [profileTags, setProfileTags] = useState<string[]>(
    card.search_tags || []
  );

  // Contact form state
  const [showContactForm, setShowContactForm] = useState(false);
  const [newContactType, setNewContactType] = useState("telegram");
  const [newContactValue, setNewContactValue] = useState("");
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Sync with prop changes
  useEffect(() => {
    setSelectedCard(card);
    setProfileTags(card.search_tags || []);
  }, [card]);

  // Текущий шаг (теперь 3 шага: bio, tags, contacts)
  const currentStep = useMemo((): EditStep => {
    if (!selectedCard.ai_generated_bio) return 1;
    if (profileTags.length === 0) return 2;
    return 3;
  }, [selectedCard, profileTags]);

  // Расчёт прогресса (3 секции: bio 33%, tags 33%, contacts 34%)
  const progressPercent = useMemo(() => {
    let progress = 0;
    if (selectedCard.ai_generated_bio) progress += 33;
    if (profileTags.length > 0) progress += 33;
    if (selectedCard.contacts && selectedCard.contacts.length > 0)
      progress += 34;
    return progress;
  }, [selectedCard, profileTags]);

  // Проверка завершённости
  const isComplete = progressPercent === 100;

  // Автоматическая загрузка AI-подсказок для тегов
  useEffect(() => {
    const bioText = selectedCard.ai_generated_bio || selectedCard.bio || "";
    if (
      bioText.trim().length >= 20 &&
      !hasFetchedSuggestions &&
      !isGeneratingTags
    ) {
      setHasFetchedSuggestions(true);
      fetchTagSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCard.ai_generated_bio, selectedCard.bio, hasFetchedSuggestions]);

  const fetchTagSuggestions = async () => {
    setIsGeneratingTags(true);
    try {
      const result = await businessCardApi.suggestTags(
        selectedCard.id,
        user.id
      );
      setAiTagSuggestions(result.suggestions.map((t: SuggestedTag) => t.name));
    } catch {
      // Ignore
    } finally {
      setIsGeneratingTags(false);
    }
  };

  // Обработка обновления карточки из UnifiedBioEditor
  const handleBioUpdate = useCallback(
    (updatedCard: BusinessCard) => {
      setSelectedCard(updatedCard);
      onCardUpdate(updatedCard);
      // Сбросить флаг для обновления тегов
      setHasFetchedSuggestions(false);
    },
    [onCardUpdate]
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
          newTags
        );
        setSelectedCard(updated);
        onCardUpdate(updated);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Ошибка сохранения тегов"
        );
      } finally {
        setIsApplyingTags(false);
      }
    },
    [user.id, selectedCard.id, onCardUpdate]
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
        }
      );
      setSelectedCard(updated);
      onCardUpdate(updated);
      setNewContactValue("");
      setShowContactForm(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка добавления контакта"
      );
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleDeleteContact = async (contact: ContactInfo) => {
    if (!confirm(`Удалить контакт ${contact.value}?`)) return;
    try {
      const updated = await businessCardApi.deleteContact(
        selectedCard.id,
        user.id,
        contact.type,
        contact.value
      );
      setSelectedCard(updated);
      onCardUpdate(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка удаления контакта");
    }
  };

  const getContactLabel = (type: string) => {
    return (
      CONTACT_TYPES.find((ct) => ct.type === type.toLowerCase())?.label || type
    );
  };

  return (
    <div className="card-editor">
      {/* Header */}
      <header className="card-editor__header">
        <div className="card-editor__header-top">
          <button className="card-editor__back" onClick={onBack}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Назад
          </button>
          <button
            className="card-editor__delete-btn"
            onClick={() => setShowDeleteConfirm(true)}
            title={
              selectedCard.is_primary ? "Очистить визитку" : "Удалить визитку"
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
          </button>
        </div>
        <div className="card-editor__title-section">
          <h1>📇 {selectedCard.title}</h1>
          {selectedCard.is_primary && (
            <span className="card-editor__badge">Основная</span>
          )}
        </div>
      </header>

      {/* Toast */}
      {error && (
        <div className="card-editor__toast" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {/* Progress */}
      <div className="card-editor__progress">
        <div className="card-editor__progress-bar">
          <div
            className="card-editor__progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="card-editor__progress-text">
          {isComplete ? "✅ Карточка готова!" : `${progressPercent}% заполнено`}
        </span>
      </div>

      {/* Content */}
      <div className="card-editor__content">
        {/* Step 1: Bio (UnifiedBioEditor) */}
        <UnifiedBioEditor
          card={selectedCard}
          userId={user.id}
          isActive={currentStep === 1}
          onCardUpdate={handleBioUpdate}
          onError={setError}
          onTagsUpdate={setAiTagSuggestions}
          onTagsLoading={setIsGeneratingTags}
        />

        {/* Step 2: Tags */}
        <section
          className={`card-editor__section card-editor__section--tags ${
            currentStep === 2 ? "card-editor__section--active" : ""
          } ${
            selectedCard.tags && selectedCard.tags.length > 0
              ? "card-editor__section--done"
              : ""
          }`}
        >
          <div className="card-editor__section-header">
            <span
              className={`card-editor__step ${
                selectedCard.tags && selectedCard.tags.length > 0
                  ? "card-editor__step--done"
                  : ""
              }`}
            >
              {selectedCard.tags && selectedCard.tags.length > 0 ? "✓" : "2"}
            </span>
            <div>
              <h2>Навыки и теги</h2>
              <p>AI предложит теги на основе описания</p>
            </div>
          </div>

          <div className="card-editor__tag-editor">
            <TagInput
              label="Ваши навыки"
              value={profileTags}
              onChange={handleTagsChange}
              placeholder="Добавьте тег..."
              suggestions={aiTagSuggestions}
              isLoadingSuggestions={isGeneratingTags}
              maxTags={15}
              disabled={!selectedCard.ai_generated_bio || isApplyingTags}
            />
            {isApplyingTags && (
              <span className="card-editor__saving">Сохранение...</span>
            )}
          </div>
        </section>

        {/* Step 3: Contacts */}
        <section
          className={`card-editor__section card-editor__section--contacts ${
            (selectedCard.contacts?.length ?? 0) > 0
              ? "card-editor__section--done"
              : ""
          }`}
        >
          <div className="card-editor__section-header">
            <span
              className={`card-editor__step ${
                (selectedCard.contacts?.length ?? 0) > 0
                  ? "card-editor__step--done"
                  : ""
              }`}
            >
              {(selectedCard.contacts?.length ?? 0) > 0 ? "✓" : "3"}
            </span>
            <div>
              <h2>Контакты</h2>
              <p>Как с вами связаться</p>
            </div>
          </div>

          {selectedCard.contacts && selectedCard.contacts.length > 0 && (
            <div className="card-editor__contacts-list">
              {selectedCard.contacts.map((contact, idx) => (
                <div key={idx} className="card-editor__contact-item">
                  <span
                    className={`card-editor__contact-icon card-editor__contact-icon--${contact.type.toLowerCase()}`}
                  />
                  <span className="card-editor__contact-type">
                    {getContactLabel(contact.type)}
                  </span>
                  <span className="card-editor__contact-value">
                    {contact.value}
                  </span>
                  <button
                    className="card-editor__contact-delete"
                    onClick={() => handleDeleteContact(contact as ContactInfo)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {showContactForm ? (
            <div className="card-editor__contact-form">
              <div className="card-editor__contact-form-row">
                <select
                  className="card-editor__select"
                  value={newContactType}
                  onChange={(e) => setNewContactType(e.target.value)}
                >
                  {CONTACT_TYPES.map((ct) => (
                    <option key={ct.type} value={ct.type}>
                      {ct.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  className="card-editor__input"
                  value={newContactValue}
                  onChange={(e) => setNewContactValue(e.target.value)}
                  placeholder={
                    CONTACT_TYPES.find((ct) => ct.type === newContactType)
                      ?.placeholder
                  }
                />
              </div>
              <div className="card-editor__contact-form-actions">
                <button
                  className="card-editor__btn card-editor__btn--secondary"
                  onClick={() => setShowContactForm(false)}
                >
                  Отмена
                </button>
                <button
                  className="card-editor__btn card-editor__btn--primary"
                  onClick={handleAddContact}
                  disabled={!newContactValue.trim() || isSavingContact}
                >
                  {isSavingContact ? "..." : "Добавить"}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="card-editor__btn card-editor__btn--primary card-editor__btn--full"
              onClick={() => setShowContactForm(true)}
            >
              ➕ Добавить контакт
            </button>
          )}
        </section>

        {/* Complete message */}
        {isComplete && (
          <div className="card-editor__complete">
            🎉 Карточка полностью заполнена и готова!
          </div>
        )}
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
                ? "Очистить визитку?"
                : "Удалить визитку?"}
            </h3>
            <p className="card-editor__modal-text">
              Визитка "{selectedCard.title}" будет{" "}
              {selectedCard.is_primary ? "очищена" : "удалена"}. Это действие
              нельзя отменить.
            </p>
            {usedByCompanies.length > 0 && (
              <div className="card-editor__modal-warning">
                <span className="card-editor__modal-warning-icon">⚠️</span>
                <div className="card-editor__modal-warning-content">
                  <strong>Внимание!</strong> Эта визитка используется в{" "}
                  {usedByCompanies.length === 1 ? "компании" : "компаниях"}:
                  <ul className="card-editor__modal-warning-list">
                    {usedByCompanies.map((c) => (
                      <li key={c.company_id}>{c.company_name}</li>
                    ))}
                  </ul>
                  После удаления вам потребуется выбрать другую визитку для{" "}
                  {usedByCompanies.length === 1
                    ? "этой компании"
                    : "этих компаний"}
                  .
                </div>
              </div>
            )}
            <div className="card-editor__modal-actions">
              <button
                className="card-editor__btn card-editor__btn--secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Отмена
              </button>
              <button
                className="card-editor__btn card-editor__btn--danger"
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await onCardDelete(selectedCard.id);
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : "Ошибка удаления"
                    );
                    setIsDeleting(false);
                    setShowDeleteConfirm(false);
                  }
                }}
                disabled={isDeleting}
              >
                {isDeleting
                  ? selectedCard.is_primary
                    ? "Очистка..."
                    : "Удаление..."
                  : selectedCard.is_primary
                  ? "Очистить"
                  : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
