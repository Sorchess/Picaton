import { useState, useEffect, useCallback, useMemo } from "react";
import type { User, ContactInfo } from "@/entities/user";
import { getFullName } from "@/entities/user";
import { userApi } from "@/entities/user";
import { useAuth } from "@/features/auth";
import { AvatarUpload } from "@/features/avatar-upload";
import { Loader } from "@/shared";
import "./ProfilePage.scss";

// Конфигурация типов контактов
const CONTACT_TYPES = [
  { type: "telegram", label: "Telegram", placeholder: "@username", icon: "telegram" },
  { type: "whatsapp", label: "WhatsApp", placeholder: "+7 999 123-45-67", icon: "whatsapp" },
  { type: "vk", label: "ВКонтакте", placeholder: "id123456", icon: "vk" },
  { type: "phone", label: "Телефон", placeholder: "+7 999 123-45-67", icon: "phone" },
  { type: "email", label: "Email", placeholder: "mail@example.com", icon: "email" },
  { type: "linkedin", label: "LinkedIn", placeholder: "username", icon: "linkedin" },
  { type: "github", label: "GitHub", placeholder: "username", icon: "github" },
  { type: "instagram", label: "Instagram", placeholder: "@username", icon: "instagram" },
  { type: "tiktok", label: "TikTok", placeholder: "@username", icon: "tiktok" },
  { type: "messenger", label: "Messenger", placeholder: "username", icon: "messenger" },
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

  // Form state
  const [bio, setBio] = useState("");
  const [isSavingBio, setIsSavingBio] = useState(false);

  // AI states
  const [isGeneratingPresentation, setIsGeneratingPresentation] =
    useState(false);
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<SuggestedTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [isApplyingTags, setIsApplyingTags] = useState(false);

  // Custom tag input
  const [customTagInput, setCustomTagInput] = useState("");
  const [customTags, setCustomTags] = useState<string[]>([]);

  // Contact form state
  const [showContactForm, setShowContactForm] = useState(false);
  const [newContactType, setNewContactType] = useState("telegram");
  const [newContactValue, setNewContactValue] = useState("");
  const [newContactVisible, setNewContactVisible] = useState(true);
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Автоматическое определение текущего шага
  const currentStep = useMemo((): ProfileStep => {
    if (!user) return 1;
    // Шаг 1: Нужно заполнить bio
    if (!bio.trim() || bio.length < 20) return 1;
    // Шаг 2: Нужно сгенерировать презентацию
    if (!user.ai_generated_bio) return 2;
    // Шаг 3: Нужно добавить теги
    if (!user.tags || user.tags.length === 0) return 3;
    // Всё готово
    return 3;
  }, [user, bio]);

  // Проверка завершённости профиля
  const profileComplete = useMemo(() => {
    if (!user) return false;
    return (
      !!bio.trim() &&
      bio.length >= 20 &&
      !!user.ai_generated_bio &&
      user.tags &&
      user.tags.length > 0
    );
  }, [user, bio]);

  const loadUser = useCallback(async () => {
    if (!authUser?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const userData = await userApi.getFull(authUser.id);
      setUser(userData);
      setBio(userData.bio || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки профиля");
    } finally {
      setIsLoading(false);
    }
  }, [authUser?.id]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Сохранение био
  const handleSaveBio = async () => {
    if (!user) return;
    setIsSavingBio(true);
    try {
      const updated = await userApi.update(user.id, { bio });
      setUser(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setIsSavingBio(false);
    }
  };

  // Генерация AI презентации
  const handleGeneratePresentation = async () => {
    if (!user || !bio.trim()) {
      setError("Сначала заполните информацию о себе");
      return;
    }
    setIsGeneratingPresentation(true);
    setError(null);
    try {
      // Сначала сохраняем био если изменилось
      if (bio !== user.bio) {
        await userApi.update(user.id, { bio });
      }
      const result = await userApi.generateBio(user.id);
      setUser({ ...user, bio, ai_generated_bio: result.bio });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка генерации");
    } finally {
      setIsGeneratingPresentation(false);
    }
  };

  // Получение предложений тегов от AI
  const handleSuggestTags = async () => {
    if (!user || !bio.trim()) {
      setError("Сначала заполните информацию о себе");
      return;
    }
    setIsGeneratingTags(true);
    setError(null);
    try {
      // Сначала сохраняем био если изменилось
      if (bio !== user.bio) {
        await userApi.update(user.id, { bio });
        setUser({ ...user, bio });
      }
      const result = await userApi.suggestTags(user.id);
      setSuggestedTags(result.suggestions);
      // Автовыбор тегов с высокой уверенностью
      const autoSelected = new Set(
        result.suggestions
          .filter((t: SuggestedTag) => t.confidence >= 0.7)
          .map((t: SuggestedTag) => t.name)
      );
      setSelectedTags(autoSelected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка генерации тегов");
    } finally {
      setIsGeneratingTags(false);
    }
  };

  // Переключение выбора тега
  const handleToggleTag = (tagName: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagName)) {
        next.delete(tagName);
      } else {
        next.add(tagName);
      }
      return next;
    });
  };

  // Добавление кастомного тега
  const handleAddCustomTag = () => {
    const tag = customTagInput.trim().toLowerCase();
    if (!tag || customTags.includes(tag) || selectedTags.has(tag)) return;
    setCustomTags((prev) => [...prev, tag]);
    setSelectedTags((prev) => new Set([...prev, tag]));
    setCustomTagInput("");
  };

  // Удаление кастомного тега
  const handleRemoveCustomTag = (tag: string) => {
    setCustomTags((prev) => prev.filter((t) => t !== tag));
    setSelectedTags((prev) => {
      const next = new Set(prev);
      next.delete(tag);
      return next;
    });
  };

  // Обработка Enter для добавления тега
  const handleCustomTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustomTag();
    }
  };

  // Применение выбранных тегов
  const handleApplyTags = async () => {
    if (!user || selectedTags.size === 0) return;
    setIsApplyingTags(true);
    try {
      const updated = await userApi.applyTags(
        user.id,
        Array.from(selectedTags)
      );
      setUser(updated);
      setSuggestedTags([]);
      setSelectedTags(new Set());
      setCustomTags([]);
      setCustomTagInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения тегов");
    } finally {
      setIsApplyingTags(false);
    }
  };

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

  // ============ Contact Management ============

  const handleAddContact = async () => {
    if (!user || !newContactValue.trim()) return;
    setIsSavingContact(true);
    setError(null);
    try {
      const updated = await userApi.addProfileContact(user.id, {
        type: newContactType,
        value: newContactValue.trim(),
        is_visible: newContactVisible,
      });
      setUser(updated);
      setNewContactValue("");
      setShowContactForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка добавления контакта");
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleToggleContactVisibility = async (contact: ContactInfo) => {
    if (!user) return;
    try {
      const updated = await userApi.updateProfileContactVisibility(
        user.id,
        contact.type,
        contact.value,
        !contact.is_visible
      );
      setUser(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка обновления контакта");
    }
  };

  const handleDeleteContact = async (contact: ContactInfo) => {
    if (!user) return;
    if (!confirm(`Удалить контакт ${contact.value}?`)) return;
    try {
      const updated = await userApi.deleteProfileContact(
        user.id,
        contact.type,
        contact.value
      );
      setUser(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка удаления контакта");
    }
  };

  const getContactLabel = (type: string) => {
    return CONTACT_TYPES.find(ct => ct.type === type.toLowerCase())?.label || type;
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

      {/* Основной контент */}
      <div className="profile__content">
        {/* Прогресс-бар профиля */}
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
              ? "✅ Профиль заполнен!"
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
              disabled={isSavingBio || bio === user.bio}
            >
              {isSavingBio ? "Сохранение..." : "Сохранить"}
            </button>
          </div>

          {/* Подсказка для перехода к следующему шагу */}
          {bio.length >= 20 && !user.ai_generated_bio && (
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
          } ${user.ai_generated_bio ? "profile__card--done" : ""}`}
        >
          <div className="profile__card-header">
            <span
              className={`profile__step ${
                user.ai_generated_bio ? "profile__step--done" : ""
              }`}
            >
              {user.ai_generated_bio ? "✓" : "2"}
            </span>
            <div>
              <h2>AI Самопрезентация</h2>
              <p>Нейросеть создаст краткое профессиональное описание</p>
            </div>
          </div>

          {currentStep === 2 && (
            <div className="profile__hint profile__hint--highlight">
              ✨ Нажмите кнопку ниже, чтобы AI создал вашу презентацию!
            </div>
          )}

          {user.ai_generated_bio ? (
            <div className="profile__presentation">
              <p>{user.ai_generated_bio}</p>
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
            ) : user.ai_generated_bio ? (
              "🔄 Перегенерировать"
            ) : (
              "✨ Создать самопрезентацию"
            )}
          </button>

          {/* Подсказка для перехода к следующему шагу */}
          {user.ai_generated_bio && (!user.tags || user.tags.length === 0) && (
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
          } ${user.tags && user.tags.length > 0 ? "profile__card--done" : ""}`}
        >
          <div className="profile__card-header">
            <span
              className={`profile__step ${
                user.tags && user.tags.length > 0 ? "profile__step--done" : ""
              }`}
            >
              {user.tags && user.tags.length > 0 ? "✓" : "3"}
            </span>
            <div>
              <h2>Навыки и теги</h2>
              <p>AI предложит теги на основе вашего описания</p>
            </div>
          </div>

          {currentStep === 3 &&
            !suggestedTags.length &&
            (!user.tags || user.tags.length === 0) && (
              <div className="profile__hint profile__hint--highlight">
                🏷️ Добавьте теги вручную или получите рекомендации от AI!
              </div>
            )}

          {/* Текущие теги */}
          {user.tags && user.tags.length > 0 && (
            <div className="profile__current-tags">
              <span className="profile__label">Ваши навыки:</span>
              <div className="profile__tags-list">
                {user.tags.map((tag, i) => (
                  <span key={i} className="profile__tag">
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Поле ввода своего тега */}
          <div className="profile__custom-tag-input">
            <span className="profile__label">Добавить свой тег:</span>
            <div className="profile__tag-input-row">
              <input
                type="text"
                className="profile__input"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={handleCustomTagKeyDown}
                placeholder="Введите тег и нажмите Enter..."
                maxLength={50}
              />
              <button
                className="profile__btn profile__btn--secondary"
                onClick={handleAddCustomTag}
                disabled={!customTagInput.trim()}
              >
                +
              </button>
            </div>
            {/* Добавленные кастомные теги */}
            {customTags.length > 0 && (
              <div className="profile__custom-tags-list">
                {customTags.map((tag) => (
                  <span key={tag} className="profile__custom-tag">
                    {tag}
                    <button
                      className="profile__custom-tag-remove"
                      onClick={() => handleRemoveCustomTag(tag)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Предложенные теги от AI */}
          {suggestedTags.length > 0 && (
            <div className="profile__suggested-tags">
              <span className="profile__label">AI рекомендует:</span>
              <div className="profile__tags-grid">
                {suggestedTags.map((tag) => (
                  <button
                    key={tag.name}
                    className={`profile__tag-chip ${
                      selectedTags.has(tag.name)
                        ? "profile__tag-chip--selected"
                        : ""
                    }`}
                    onClick={() => handleToggleTag(tag.name)}
                    title={tag.reason}
                  >
                    <span className="profile__tag-name">{tag.name}</span>
                    <span className="profile__tag-category">
                      {tag.category}
                    </span>
                    {tag.confidence >= 0.8 && (
                      <span className="profile__tag-star">⭐</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Кнопка применения тегов - показываем когда есть выбранные теги */}
          {(selectedTags.size > 0 || customTags.length > 0) && (
            <div className="profile__tags-actions">
              <span className="profile__selected-count">
                Выбрано: {selectedTags.size}
              </span>
              <button
                className="profile__btn profile__btn--primary"
                onClick={handleApplyTags}
                disabled={selectedTags.size === 0 || isApplyingTags}
              >
                {isApplyingTags ? "Сохранение..." : "Сохранить теги"}
              </button>
            </div>
          )}

          {/* Кнопка генерации */}
          {suggestedTags.length === 0 && (
            <button
              className={`profile__btn profile__btn--primary profile__btn--full ${
                currentStep === 3 && (!user.tags || user.tags.length === 0)
                  ? "profile__btn--pulse"
                  : ""
              }`}
              onClick={handleSuggestTags}
              disabled={isGeneratingTags || !bio.trim() || bio.length < 20}
            >
              {isGeneratingTags ? (
                <>
                  <span className="profile__spinner" />
                  Анализ...
                </>
              ) : user.tags && user.tags.length > 0 ? (
                "🏷️ Добавить ещё теги"
              ) : (
                "🏷️ Предложить теги"
              )}
            </button>
          )}

          {/* Поздравление при завершении */}
          {profileComplete && (
            <div className="profile__complete-message">
              🎉 Отлично! Ваш профиль полностью заполнен и готов к работе!
            </div>
          )}
        </section>

        {/* Шаг 4: Контакты для связи */}
        <section className="profile__card profile__card--contacts">
          <div className="profile__card-header">
            <span className={`profile__step ${user.contacts?.length > 0 ? "profile__step--done" : ""}`}>
              {user.contacts?.length > 0 ? "✓" : "4"}
            </span>
            <div>
              <h2>Контакты для связи</h2>
              <p>Укажите как с вами связаться (минимум 1 контакт)</p>
            </div>
          </div>

          {/* Список текущих контактов */}
          {user.contacts && user.contacts.length > 0 && (
            <div className="profile__contacts-list">
              {user.contacts.map((contact, idx) => (
                <div key={idx} className="profile__contact-item">
                  <span className={`profile__contact-icon profile__contact-icon--${contact.type.toLowerCase()}`} />
                  <span className="profile__contact-type">{getContactLabel(contact.type)}</span>
                  <span className="profile__contact-value">{contact.value}</span>
                  <button
                    className={`profile__contact-visibility ${contact.is_visible ? "" : "profile__contact-visibility--hidden"}`}
                    onClick={() => handleToggleContactVisibility(contact)}
                    title={contact.is_visible ? "Виден в профиле" : "Скрыт от других"}
                  >
                    {contact.is_visible ? "👁️" : "🔒"}
                  </button>
                  <button
                    className="profile__contact-delete"
                    onClick={() => handleDeleteContact(contact)}
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
                  placeholder={CONTACT_TYPES.find(ct => ct.type === newContactType)?.placeholder}
                />
              </div>
              <div className="profile__contact-form-row">
                <label className="profile__checkbox-label">
                  <input
                    type="checkbox"
                    checked={newContactVisible}
                    onChange={(e) => setNewContactVisible(e.target.checked)}
                  />
                  <span>Показывать в профиле</span>
                </label>
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

          {/* Предупреждение если нет публичных контактов */}
          {user.contacts && user.contacts.length > 0 && !user.contacts.some(c => c.is_visible) && (
            <div className="profile__warning">
              ⚠️ У вас нет публичных контактов. Добавьте хотя бы один видимый контакт для связи.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
