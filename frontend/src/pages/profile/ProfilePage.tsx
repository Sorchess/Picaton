import { useState, useEffect, useCallback, useMemo } from "react";
import type { User, ContactInfo } from "@/entities/user";
import { getFullName } from "@/entities/user";
import { userApi } from "@/entities/user";
import type { BusinessCard } from "@/entities/business-card";
import { businessCardApi } from "@/entities/business-card";
import { useAuth } from "@/features/auth";
import { AvatarUpload } from "@/features/avatar-upload";
import { CardSelector } from "@/features/card-selector";
import { Loader, TagInput } from "@/shared";
import "./ProfilePage.scss";

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

type ProfileStep = 1 | 2 | 3;

export function ProfilePage() {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Business card state
  const [selectedCard, setSelectedCard] = useState<BusinessCard | null>(null);

  // Form state - теперь для карточки
  const [bio, setBio] = useState("");
  const [isSavingBio, setIsSavingBio] = useState(false);

  // AI states
  const [isGeneratingPresentation, setIsGeneratingPresentation] =
    useState(false);
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [aiTagSuggestions, setAiTagSuggestions] = useState<string[]>([]);
  const [isApplyingTags, setIsApplyingTags] = useState(false);
  const [hasFetchedSuggestions, setHasFetchedSuggestions] = useState(false);

  // Tag editing state
  const [profileTags, setProfileTags] = useState<string[]>([]);

  // Contact form state
  const [showContactForm, setShowContactForm] = useState(false);
  const [newContactType, setNewContactType] = useState("telegram");
  const [newContactValue, setNewContactValue] = useState("");
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Автоматическое определение текущего шага (теперь на основе карточки)
  const currentStep = useMemo((): ProfileStep => {
    if (!selectedCard) return 1;
    // Шаг 1: Нужно заполнить bio
    if (!bio.trim() || bio.length < 20) return 1;
    // Шаг 2: Нужно сгенерировать презентацию
    if (!selectedCard.ai_generated_bio) return 2;
    // Шаг 3: Нужно добавить теги
    if (!selectedCard.tags || selectedCard.tags.length === 0) return 3;
    // Всё готово
    return 3;
  }, [selectedCard, bio]);

  // Проверка завершённости карточки
  const profileComplete = useMemo(() => {
    if (!selectedCard) return false;
    return (
      !!bio.trim() &&
      bio.length >= 20 &&
      !!selectedCard.ai_generated_bio &&
      selectedCard.tags &&
      selectedCard.tags.length > 0
    );
  }, [selectedCard, bio]);

  const loadUser = useCallback(async () => {
    if (!authUser?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const userData = await userApi.getFull(authUser.id);
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки профиля");
    } finally {
      setIsLoading(false);
    }
  }, [authUser?.id]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Обработка выбора карточки
  const handleCardSelect = useCallback((card: BusinessCard) => {
    setSelectedCard(card);
    setBio(card.bio || "");
    setProfileTags(card.search_tags || []);
    setHasFetchedSuggestions(false); // Сбрасываем для новой карточки
    setAiTagSuggestions([]);
  }, []);

  // Автоматическая загрузка AI-подсказок для тегов (только один раз на карточку)
  useEffect(() => {
    if (
      selectedCard &&
      bio.trim().length >= 20 &&
      !hasFetchedSuggestions &&
      !isGeneratingTags
    ) {
      setHasFetchedSuggestions(true);
      handleSuggestTagsForCard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCard, bio, hasFetchedSuggestions]);

  // Сохранение био карточки
  const handleSaveBio = async () => {
    if (!user || !selectedCard) return;
    setIsSavingBio(true);
    try {
      const updated = await businessCardApi.update(selectedCard.id, user.id, {
        bio,
      });
      setSelectedCard(updated);

      // Обновляем предложения тегов после изменения био
      if (bio.trim().length >= 20) {
        setIsGeneratingTags(true);
        try {
          // Используем cards API для suggestTags
          const result = await businessCardApi.suggestTags(
            selectedCard.id,
            user.id
          );
          setAiTagSuggestions(
            result.suggestions.map((t: SuggestedTag) => t.name)
          );
        } catch {
          // Игнорируем ошибки генерации тегов
        } finally {
          setIsGeneratingTags(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setIsSavingBio(false);
    }
  };

  // Генерация AI презентации для карточки
  const handleGeneratePresentation = async () => {
    if (!user || !selectedCard || !bio.trim()) {
      setError("Сначала заполните информацию о себе");
      return;
    }
    setIsGeneratingPresentation(true);
    setError(null);
    try {
      // Сначала сохраняем био если изменилось
      if (bio !== selectedCard.bio) {
        await businessCardApi.update(selectedCard.id, user.id, { bio });
      }
      const result = await businessCardApi.generateBio(
        selectedCard.id,
        user.id
      );
      setSelectedCard({ ...selectedCard, bio, ai_generated_bio: result.bio });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка генерации");
    } finally {
      setIsGeneratingPresentation(false);
    }
  };

  // Получение предложений тегов от AI для карточки
  const handleSuggestTagsForCard = async () => {
    if (!user || !selectedCard || !bio.trim()) {
      setError("Сначала заполните информацию о себе");
      return;
    }
    setIsGeneratingTags(true);
    setError(null);
    try {
      // Сначала сохраняем био если изменилось
      if (bio !== selectedCard.bio) {
        await businessCardApi.update(selectedCard.id, user.id, { bio });
        setSelectedCard({ ...selectedCard, bio });
      }
      // Используем cards API для suggest tags
      const result = await businessCardApi.suggestTags(
        selectedCard.id,
        user.id
      );
      setAiTagSuggestions(result.suggestions.map((t: SuggestedTag) => t.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка генерации тегов");
    } finally {
      setIsGeneratingTags(false);
    }
  };

  // Применение тегов карточки (автосохранение)
  const handleTagsChange = useCallback(
    async (newTags: string[]) => {
      setProfileTags(newTags);
      if (!user || !selectedCard) return;

      // Автоматически сохраняем теги (включая пустой массив)
      setIsApplyingTags(true);
      try {
        const updated = await businessCardApi.updateSearchTags(
          selectedCard.id,
          user.id,
          newTags
        );
        setSelectedCard(updated);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Ошибка сохранения тегов"
        );
      } finally {
        setIsApplyingTags(false);
      }
    },
    [user, selectedCard]
  );

  // Загрузка аватарки
  const handleAvatarUpload = useCallback(
    async (file: File) => {
      if (!user) throw new Error("User not loaded");
      const result = await userApi.uploadAvatar(user.id, file);
      setUser({ ...user, avatar_url: result.avatar_url });
      return result;
    },
    [user]
  );

  // QR код
  const handleGetQrCode = async () => {
    if (!user) return;
    try {
      const qr = await userApi.getQRCode(user.id);
      const win = window.open("", "_blank");
      if (win) {
        const imageData = qr.qr_code_base64 || qr.image_base64;
        win.document.write(`
          <html>
            <head><title>QR Code - ${getFullName(user)}</title></head>
            <body style="display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0a0a0a;">
              <img src="${imageData}" alt="QR Code" style="max-width:300px;border-radius:16px;"/>
            </body>
          </html>
        `);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка генерации QR");
    }
  };

  // ============ Contact Management (для карточки) ============

  const handleAddContact = async () => {
    if (!user || !selectedCard || !newContactValue.trim()) return;
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
    if (!user || !selectedCard) return;
    if (!confirm(`Удалить контакт ${contact.value}?`)) return;
    try {
      const updated = await businessCardApi.deleteContact(
        selectedCard.id,
        user.id,
        contact.type,
        contact.value
      );
      setSelectedCard(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка удаления контакта");
    }
  };

  const getContactLabel = (type: string) => {
    return (
      CONTACT_TYPES.find((ct) => ct.type === type.toLowerCase())?.label || type
    );
  };

  if (isLoading) {
    return (
      <div className="profile">
        <div className="profile__loading">
          <Loader />
          <p>Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile">
        <div className="profile__error">
          <p>{error || "Не удалось загрузить профиль"}</p>
          <button onClick={loadUser}>Повторить</button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile">
      {/* Toast для ошибок */}
      {error && (
        <div className="profile__toast" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {/* Шапка профиля */}
      <header className="profile__header">
        <div className="profile__user">
          <AvatarUpload
            currentAvatarUrl={user.avatar_url}
            onUpload={handleAvatarUpload}
            size={80}
            name={getFullName(user)}
            showHint={false}
          />
          <div className="profile__user-info">
            <h1>{getFullName(user)}</h1>
            <span className="profile__email">{user.email}</span>
          </div>
        </div>
        <button className="profile__qr-btn" onClick={handleGetQrCode}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect
              x="3"
              y="3"
              width="7"
              height="7"
              rx="1"
              stroke="currentColor"
              strokeWidth="2"
            />
            <rect
              x="14"
              y="3"
              width="7"
              height="7"
              rx="1"
              stroke="currentColor"
              strokeWidth="2"
            />
            <rect
              x="3"
              y="14"
              width="7"
              height="7"
              rx="1"
              stroke="currentColor"
              strokeWidth="2"
            />
            <rect x="14" y="14" width="3" height="3" fill="currentColor" />
            <rect x="18" y="14" width="3" height="3" fill="currentColor" />
            <rect x="14" y="18" width="3" height="3" fill="currentColor" />
            <rect x="18" y="18" width="3" height="3" fill="currentColor" />
          </svg>
          QR код
        </button>
      </header>

      {/* Выбор визитной карточки */}
      <CardSelector
        ownerId={user.id}
        selectedCardId={selectedCard?.id || null}
        onCardSelect={handleCardSelect}
      />

      {/* Основной контент */}
      <div className="profile__content">
        {/* Информация о текущей карточке */}
        {selectedCard && (
          <div className="profile__card-info">
            <span className="profile__card-title">
              📇 {selectedCard.title}
              {selectedCard.is_primary && (
                <span className="profile__card-primary-badge"> (основная)</span>
              )}
            </span>
          </div>
        )}

        {/* Прогресс-бар карточки */}
        <div className="profile__progress">
          <div className="profile__progress-bar">
            <div
              className="profile__progress-fill"
              style={{
                width: profileComplete
                  ? "100%"
                  : currentStep === 1
                  ? "10%"
                  : currentStep === 2
                  ? "40%"
                  : "70%",
              }}
            />
          </div>
          <span className="profile__progress-text">
            {profileComplete
              ? "✅ Карточка заполнена!"
              : `Шаг ${currentStep} из 3`}
          </span>
        </div>

        {/* Шаг 1: Информация о себе */}
        <section
          className={`profile__card ${
            currentStep === 1 ? "profile__card--active" : ""
          } ${bio.length >= 20 ? "profile__card--done" : ""}`}
        >
          <div className="profile__card-header">
            <span
              className={`profile__step ${
                bio.length >= 20 ? "profile__step--done" : ""
              }`}
            >
              {bio.length >= 20 ? "✓" : "1"}
            </span>
            <div>
              <h2>Расскажите о себе</h2>
              <p>Опишите свой опыт, навыки и достижения</p>
            </div>
          </div>

          {currentStep === 1 && (
            <div className="profile__hint">
              👋 Начните с описания вашей профессии и ключевых навыков
            </div>
          )}

          <textarea
            className="profile__textarea"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Например: Python разработчик с 5-летним опытом. Работал над высоконагруженными системами, оптимизировал API на 40%. Занимаюсь UI/UX дизайном и вёрсткой..."
            rows={5}
          />

          <div className="profile__card-footer">
            <span className="profile__char-count">
              {bio.length} / 2000 символов
              {bio.length > 0 && bio.length < 20 && (
                <span className="profile__char-hint">
                  {" "}
                  (минимум 20 символов)
                </span>
              )}
            </span>
            <button
              className="profile__btn profile__btn--secondary"
              onClick={handleSaveBio}
              disabled={isSavingBio || bio === (selectedCard?.bio || "")}
            >
              {isSavingBio ? "Сохранение..." : "Сохранить"}
            </button>
          </div>

          {/* Подсказка для перехода к следующему шагу */}
          {bio.length >= 20 && !selectedCard?.ai_generated_bio && (
            <div className="profile__next-hint">
              <span className="profile__arrow">↓</span>
              Отлично! Теперь создайте AI презентацию
            </div>
          )}
        </section>

        {/* Шаг 2: AI Самопрезентация */}
        <section
          className={`profile__card profile__card--ai ${
            currentStep === 2 ? "profile__card--active" : ""
          } ${selectedCard?.ai_generated_bio ? "profile__card--done" : ""}`}
        >
          <div className="profile__card-header">
            <span
              className={`profile__step ${
                selectedCard?.ai_generated_bio ? "profile__step--done" : ""
              }`}
            >
              {selectedCard?.ai_generated_bio ? "✓" : "2"}
            </span>
            <div>
              <h2>Самопрезентация</h2>
              <p>Нейросеть создаст краткое профессиональное описание</p>
            </div>
          </div>

          {currentStep === 2 && (
            <div className="profile__hint profile__hint--highlight">
              ✨ Нажмите кнопку ниже, чтобы AI создал вашу презентацию!
            </div>
          )}

          {selectedCard?.ai_generated_bio ? (
            <div className="profile__presentation">
              <p>{selectedCard.ai_generated_bio}</p>
            </div>
          ) : bio.length < 20 ? (
            <div className="profile__presentation profile__presentation--empty profile__presentation--locked">
              <span className="profile__presentation-icon">🔒</span>
              <p>Сначала заполните информацию о себе</p>
            </div>
          ) : (
            <div className="profile__presentation profile__presentation--empty">
              <span className="profile__presentation-icon">✨</span>
              <p>Нажмите кнопку ниже, чтобы AI создал вашу самопрезентацию</p>
            </div>
          )}

          <button
            className={`profile__btn profile__btn--primary profile__btn--full ${
              currentStep === 2 ? "profile__btn--pulse" : ""
            }`}
            onClick={handleGeneratePresentation}
            disabled={
              isGeneratingPresentation || !bio.trim() || bio.length < 20
            }
          >
            {isGeneratingPresentation ? (
              <>
                <span className="profile__spinner" />
                Генерация...
              </>
            ) : selectedCard?.ai_generated_bio ? (
              "🔄 Перегенерировать"
            ) : (
              "✨ Создать самопрезентацию"
            )}
          </button>

          {/* Подсказка для перехода к следующему шагу */}
          {selectedCard?.ai_generated_bio &&
            (!selectedCard.tags || selectedCard.tags.length === 0) && (
              <div className="profile__next-hint">
                <span className="profile__arrow">↓</span>
                Супер! Осталось добавить теги навыков
              </div>
            )}
        </section>

        {/* Шаг 3: AI Теги и навыки */}
        <section
          className={`profile__card profile__card--tags ${
            currentStep === 3 ? "profile__card--active" : ""
          } ${
            selectedCard?.tags && selectedCard.tags.length > 0
              ? "profile__card--done"
              : ""
          }`}
        >
          <div className="profile__card-header">
            <span
              className={`profile__step ${
                selectedCard?.tags && selectedCard.tags.length > 0
                  ? "profile__step--done"
                  : ""
              }`}
            >
              {selectedCard?.tags && selectedCard.tags.length > 0 ? "✓" : "3"}
            </span>
            <div>
              <h2>Навыки и теги</h2>
              <p>AI предложит теги на основе вашего описания</p>
            </div>
          </div>

          {currentStep === 3 &&
            !aiTagSuggestions.length &&
            profileTags.length === 0 && (
              <div className="profile__hint profile__hint--highlight">
                🏷️ Добавьте теги вручную или получите рекомендации от AI!
              </div>
            )}

          {/* Редактор тегов с TagInput */}
          <div className="profile__tag-editor">
            <TagInput
              label="Ваши навыки и теги"
              value={profileTags}
              onChange={handleTagsChange}
              placeholder="Добавьте тег..."
              suggestions={aiTagSuggestions}
              isLoadingSuggestions={isGeneratingTags}
              maxTags={15}
              disabled={bio.length < 20 || isApplyingTags}
            />
            {isApplyingTags && (
              <span className="profile__saving-indicator">Сохранение...</span>
            )}
          </div>

          {/* Поздравление при завершении */}
          {profileComplete && (
            <div className="profile__complete-message">
              🎉 Отлично! Карточка полностью заполнена и готова к работе!
            </div>
          )}
        </section>

        {/* Шаг 4: Контакты для связи (карточки) */}
        <section className="profile__card profile__card--contacts">
          <div className="profile__card-header">
            <span
              className={`profile__step ${
                (selectedCard?.contacts?.length ?? 0) > 0
                  ? "profile__step--done"
                  : ""
              }`}
            >
              {(selectedCard?.contacts?.length ?? 0) > 0 ? "✓" : "4"}
            </span>
            <div>
              <h2>Контакты для связи</h2>
              <p>Укажите как с вами связаться (минимум 1 контакт)</p>
            </div>
          </div>

          {/* Список текущих контактов */}
          {selectedCard?.contacts && selectedCard.contacts.length > 0 && (
            <div className="profile__contacts-list">
              {selectedCard.contacts.map((contact, idx) => (
                <div key={idx} className="profile__contact-item">
                  <span
                    className={`profile__contact-icon profile__contact-icon--${contact.type.toLowerCase()}`}
                  />
                  <span className="profile__contact-type">
                    {getContactLabel(contact.type)}
                  </span>
                  <span className="profile__contact-value">
                    {contact.value}
                  </span>
                  <button
                    className="profile__contact-delete"
                    onClick={() => handleDeleteContact(contact as ContactInfo)}
                    title="Удалить"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Форма добавления контакта */}
          {showContactForm ? (
            <div className="profile__contact-form">
              <div className="profile__contact-form-row">
                <select
                  className="profile__select"
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
                  className="profile__input"
                  value={newContactValue}
                  onChange={(e) => setNewContactValue(e.target.value)}
                  placeholder={
                    CONTACT_TYPES.find((ct) => ct.type === newContactType)
                      ?.placeholder
                  }
                />
              </div>
              <div className="profile__contact-form-actions">
                <button
                  className="profile__btn profile__btn--secondary"
                  onClick={() => setShowContactForm(false)}
                >
                  Отмена
                </button>
                <button
                  className="profile__btn profile__btn--primary"
                  onClick={handleAddContact}
                  disabled={!newContactValue.trim() || isSavingContact}
                >
                  {isSavingContact ? "Сохранение..." : "Добавить"}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="profile__btn profile__btn--primary profile__btn--full"
              onClick={() => setShowContactForm(true)}
            >
              ➕ Добавить контакт
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
