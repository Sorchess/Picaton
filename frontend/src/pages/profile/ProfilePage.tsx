import { useState, useEffect, useCallback } from "react";
import type { User } from "@/entities/user";
import { getFullName } from "@/entities/user";
import { userApi } from "@/entities/user";
import type { BusinessCard } from "@/entities/business-card";
import { businessCardApi } from "@/entities/business-card";
import type { CompanyCardAssignment } from "@/entities/company";
import { companyApi } from "@/entities/company";
import { useAuth } from "@/features/auth";
import { AvatarUpload } from "@/features/avatar-upload";
import { QrModal } from "@/features/qr-modal";
import { Loader, Button, Modal } from "@/shared";
import { CardEditor, CardPreview } from "./components";
import "./ProfilePage.scss";

type ViewMode = "overview" | "edit-card";

export function ProfilePage() {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cards state
  const [cards, setCards] = useState<BusinessCard[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(true);

  // Company card assignments
  const [cardAssignments, setCardAssignments] = useState<
    CompanyCardAssignment[]
  >([]);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [editingCard, setEditingCard] = useState<BusinessCard | null>(null);

  // Create card modal
  const [showCreateModal, setShowCreateModal] = useState(false);

  // QR code modal
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

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

  const loadCards = useCallback(async () => {
    if (!authUser?.id) return;
    setIsLoadingCards(true);
    try {
      const response = await businessCardApi.getAll(authUser.id);
      setCards(response.cards);
    } catch {
      // Ignore card loading errors
    } finally {
      setIsLoadingCards(false);
    }
  }, [authUser?.id]);

  const loadCardAssignments = useCallback(async () => {
    try {
      const assignments = await companyApi.getMyCardAssignments();
      setCardAssignments(assignments);
    } catch {
      // Ignore errors
    }
  }, []);

  // Получить компании, которые используют данную визитку
  const getCompaniesUsingCard = useCallback(
    (cardId: string): CompanyCardAssignment[] => {
      return cardAssignments.filter((a) => a.selected_card_id === cardId);
    },
    [cardAssignments]
  );

  useEffect(() => {
    loadUser();
    loadCards();
    loadCardAssignments();
  }, [loadUser, loadCards, loadCardAssignments]);

  // Открытие редактора карточки
  const handleOpenCard = (card: BusinessCard) => {
    setEditingCard(card);
    setViewMode("edit-card");
  };

  // Возврат к обзору
  const handleBackToOverview = () => {
    setViewMode("overview");
    setEditingCard(null);
    // Перезагружаем карточки для актуализации данных
    loadCards();
  };

  // Обновление карточки из редактора
  const handleCardUpdate = (updatedCard: BusinessCard) => {
    setEditingCard(updatedCard);
    setCards((prev) =>
      prev.map((c) => (c.id === updatedCard.id ? updatedCard : c))
    );
  };

  // Удаление или очистка карточки
  const handleCardDelete = async (cardId: string) => {
    if (!user) return;

    const cardToDelete = cards.find((c) => c.id === cardId);

    if (cardToDelete?.is_primary) {
      // Для основной карточки - очищаем содержимое
      const clearedCard = await businessCardApi.clearContent(cardId, user.id);
      setCards((prev) => prev.map((c) => (c.id === cardId ? clearedCard : c)));
      handleBackToOverview();
    } else {
      // Для обычной карточки - удаляем полностью
      await businessCardApi.delete(cardId, user.id);
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      handleBackToOverview();
    }
  };

  // Создание новой карточки
  const handleCreateCard = async () => {
    if (!user || !newCardTitle.trim()) return;
    setIsCreating(true);
    try {
      const newCard = await businessCardApi.create(user.id, {
        title: newCardTitle.trim(),
      });
      setCards([...cards, newCard]);
      setNewCardTitle("");
      setShowCreateModal(false);
      // Сразу открываем для редактирования
      handleOpenCard(newCard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка создания карточки");
    } finally {
      setIsCreating(false);
    }
  };

  // Загрузка аватара
  const handleAvatarUpload = useCallback(
    async (file: File) => {
      if (!user) throw new Error("User not loaded");
      const result = await userApi.uploadAvatar(user.id, file);
      setUser({ ...user, avatar_url: result.avatar_url });
      return result;
    },
    [user]
  );

  // QR код карточки
  const [qrCardName, setQrCardName] = useState<string | undefined>();

  // Visibility toggle
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

  const handleVisibilityToggle = async () => {
    if (!user || isUpdatingVisibility) return;
    setIsUpdatingVisibility(true);
    try {
      const updatedUser = await userApi.updateVisibility(
        user.id,
        !user.is_public
      );
      setUser(updatedUser);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка изменения видимости"
      );
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  const handleShareCard = async (card: BusinessCard) => {
    try {
      const qr = await businessCardApi.getQRCode(card.id);
      setQrCodeImage(qr.image_base64);
      setQrCardName(card.title);
      setShowQrModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка генерации QR");
    }
  };

  // Loading state
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

  // Error state
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

  // Edit card view
  if (viewMode === "edit-card" && editingCard) {
    return (
      <CardEditor
        card={editingCard}
        user={user}
        usedByCompanies={getCompaniesUsingCard(editingCard.id)}
        onBack={handleBackToOverview}
        onCardUpdate={handleCardUpdate}
        onCardDelete={handleCardDelete}
      />
    );
  }

  // Overview mode
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

        {/* Переключатель видимости */}
        <div className="profile__visibility">
          <button
            className={`profile__visibility-toggle ${
              user.is_public
                ? "profile__visibility-toggle--public"
                : "profile__visibility-toggle--private"
            }`}
            onClick={handleVisibilityToggle}
            disabled={isUpdatingVisibility}
            title={
              user.is_public
                ? "Профиль виден всем в поиске"
                : "Профиль виден только внутри компании"
            }
          >
            <span className="profile__visibility-icon">
              {user.is_public ? "🌍" : "🔒"}
            </span>
            <span className="profile__visibility-text">
              {isUpdatingVisibility
                ? "..."
                : user.is_public
                ? "Публичный"
                : "Приватный"}
            </span>
          </button>
        </div>
      </header>

      {/* Секция карточек */}
      <section className="profile__cards-section">
        <div className="profile__cards-header">
          <h2>📇 Мои визитки</h2>
          <span className="profile__cards-count">{cards.length} / 5</span>
        </div>

        {isLoadingCards ? (
          <div className="profile__cards-loading">
            <Loader />
          </div>
        ) : (
          <div className="profile__cards-list">
            {cards.map((card) => (
              <CardPreview
                key={card.id}
                card={card}
                usedByCompanies={getCompaniesUsingCard(card.id)}
                onClick={() => handleOpenCard(card)}
                onShare={handleShareCard}
              />
            ))}

            {/* Кнопка создания новой карточки */}
            {cards.length < 5 && (
              <button
                className="profile__add-card"
                onClick={() => setShowCreateModal(true)}
              >
                <span className="profile__add-card-icon">+</span>
                <span className="profile__add-card-text">Создать визитку</span>
              </button>
            )}
          </div>
        )}
      </section>

      {/* Модалка создания карточки */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Новая визитка"
      >
        <div className="profile__create-modal">
          <p className="profile__create-hint">
            Придумайте название для вашей визитки. Например: "Разработчик",
            "Дизайнер" или "Личная"
          </p>
          <input
            type="text"
            className="profile__create-input"
            value={newCardTitle}
            onChange={(e) => setNewCardTitle(e.target.value)}
            placeholder="Название визитки"
            maxLength={50}
          />
          <div className="profile__create-actions">
            <Button
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Отмена
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateCard}
              disabled={!newCardTitle.trim() || isCreating}
            >
              {isCreating ? "Создание..." : "Создать"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* QR Code Modal */}
      {qrCodeImage && (
        <QrModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          qrCodeImage={qrCodeImage}
          userName={qrCardName || getFullName(user)}
        />
      )}
    </div>
  );
}
