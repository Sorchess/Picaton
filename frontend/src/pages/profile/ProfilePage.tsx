import { useState, useEffect, useCallback } from "react";
import type { User } from "@/entities/user";
import { getFullName } from "@/entities/user";
import { userApi } from "@/entities/user";
import type { BusinessCard } from "@/entities/business-card";
import { businessCardApi } from "@/entities/business-card";
import type { CompanyCardAssignment } from "@/entities/company";
import { companyApi } from "@/entities/company";
import { useAuth } from "@/features/auth";
import { QrModal } from "@/features/qr-modal";
import { Loader, Button, Modal } from "@/shared";
import {
  CardEditor,
  CardPreview,
  ProfileHeroBlock,
  RoleTabs,
  ProfileInfoCard,
  SocialTrustCard,
  ProfileTopBar,
  CheckIcon,
  UsersIcon,
} from "./components";
import type { RoleTab } from "./components";
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
  const [qrCardName, setQrCardName] = useState<string | undefined>();

  // Active role for tabs
  const [activeRoleId, setActiveRoleId] = useState("personal");

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
    [cardAssignments],
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
    loadCards();
  };

  // Обновление карточки из редактора
  const handleCardUpdate = (updatedCard: BusinessCard) => {
    setEditingCard(updatedCard);
    setCards((prev) =>
      prev.map((c) => (c.id === updatedCard.id ? updatedCard : c)),
    );
  };

  // Удаление или очистка карточки
  const handleCardDelete = async (cardId: string) => {
    if (!user) return;

    const cardToDelete = cards.find((c) => c.id === cardId);

    if (cardToDelete?.is_primary) {
      const clearedCard = await businessCardApi.clearContent(cardId, user.id);
      setCards((prev) => prev.map((c) => (c.id === cardId ? clearedCard : c)));
      handleBackToOverview();
    } else {
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
      handleOpenCard(newCard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка создания карточки");
    } finally {
      setIsCreating(false);
    }
  };

  // QR код профиля
  const handleShareProfile = async () => {
    if (!user) return;

    const primaryCard = cards.find((c) => c.is_primary) || cards[0];

    if (primaryCard) {
      try {
        const qr = await businessCardApi.getQRCode(primaryCard.id);
        setQrCodeImage(qr.image_base64);
        setQrCardName(getFullName(user));
        setShowQrModal(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка генерации QR");
      }
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

  // Generate roles from user data
  const generateRoles = useCallback((): RoleTab[] => {
    const roles: RoleTab[] = [{ id: "personal", name: "Личный", emoji: "🔥" }];

    cards.forEach((card) => {
      if (!card.is_primary && card.title) {
        roles.push({
          id: card.id,
          name: card.title,
          emoji: "🌟",
        });
      }
    });

    return roles;
  }, [cards]);

  // Extract user roles for display
  const getUserRoles = useCallback((): string[] => {
    const roles: string[] = [];

    if (user?.position) {
      roles.push(user.position);
    }

    if (user?.tags && user.tags.length > 0) {
      user.tags.slice(0, 3).forEach((tag) => {
        roles.push(tag.name);
      });
    }

    if (roles.length === 0) {
      roles.push("Пользователь");
    }

    return roles;
  }, [user]);

  // Format birth date
  const formatBirthDate = (dateStr?: string | null): string | undefined => {
    if (!dateStr) return undefined;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch {
      return undefined;
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

  // Skills count
  const skillsCount = user.tags?.length || 0;
  // Recommendations count (can be fetched from API later)
  const recommendationsCount = 120;
  // User level (based on profile completeness)
  const userLevel = Math.floor(user.profile_completeness / 4) + 1;

  // Trust items
  const trustItems = [
    {
      id: "skills",
      icon: <CheckIcon />,
      title: "Подтвержденные скиллы",
      subtitle: `${skillsCount} подтверждений`,
      variant: "blue" as const,
      onClick: () => {},
    },
    {
      id: "contacts",
      icon: <UsersIcon />,
      title: "Совместных контактов",
      subtitle: `${cards.length * 10} контактов`,
      variant: "purple" as const,
      onClick: () => {},
    },
  ];

  // Hobbies (from tags or mock data)
  const hobbies =
    user.search_tags?.slice(0, 5).map((tag, i) => ({
      id: `hobby-${i}`,
      icon: "❤️",
      name: tag,
    })) || [];

  // Overview mode - new Figma design
  return (
    <div className="profile">
      {/* Toast для ошибок */}
      {error && (
        <div className="profile__toast" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {/* Top Bar */}
      <ProfileTopBar
        onLeftClick={() => {
          /* Navigate to settings */
        }}
        onRightClick={handleShareProfile}
      />

      {/* Content */}
      <div className="profile__content">
        {/* Hero Block */}
        <ProfileHeroBlock
          name={getFullName(user)}
          avatarUrl={user.avatar_url}
          roles={getUserRoles()}
          skillsCount={skillsCount}
          recommendationsCount={recommendationsCount}
          level={userLevel}
        />

        {/* Role Tabs */}
        <RoleTabs
          roles={generateRoles()}
          activeRoleId={activeRoleId}
          onChange={setActiveRoleId}
        />

        {/* Info Card */}
        <ProfileInfoCard
          phone={user.contacts?.find((c) => c.type === "phone")?.value}
          username={user.telegram_username || undefined}
          onUsernameClick={() => {
            if (user.telegram_username) {
              navigator.clipboard.writeText(`@${user.telegram_username}`);
            }
          }}
          birthDate={formatBirthDate(user.created_at)}
          hobbies={hobbies}
        />

        {/* Social Trust Card */}
        <SocialTrustCard items={trustItems} />

        {/* Cards Section */}
        {activeRoleId !== "personal" && (
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

                {cards.length < 5 && (
                  <button
                    className="profile__add-card"
                    onClick={() => setShowCreateModal(true)}
                  >
                    <span className="profile__add-card-icon">+</span>
                    <span className="profile__add-card-text">
                      Создать визитку
                    </span>
                  </button>
                )}
              </div>
            )}
          </section>
        )}
      </div>

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
