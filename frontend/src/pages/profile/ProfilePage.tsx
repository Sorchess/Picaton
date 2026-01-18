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
  ProfileHeroBlock,
  RoleTabs,
  ProfileInfoCard,
  SocialTrustCard,
  ProfileTopBar,
  CheckIcon,
  UsersIcon,
  ShareMenu,
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

  // Share menu
  const [showShareMenu, setShowShareMenu] = useState(false);

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
    try {
      const response = await businessCardApi.getAll(authUser.id);
      setCards(response.cards);
    } catch {
      // Ignore card loading errors
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

  // Открыть меню выбора визиток для шаринга
  const handleShareProfile = () => {
    if (!user || cards.length === 0) return;
    setShowShareMenu(true);
  };

  // Обработка шаринга выбранных визиток
  const handleShareSelectedCards = async (selectedCardIds: string[]) => {
    if (selectedCardIds.length === 0) return;

    try {
      // Для простоты показываем QR первой выбранной визитки
      const firstSelectedCard = cards.find((c) =>
        selectedCardIds.includes(c.id),
      );
      if (firstSelectedCard && user) {
        const qr = await businessCardApi.getQRCode(firstSelectedCard.id);
        setQrCodeImage(qr.image_base64);
        setQrCardName(firstSelectedCard.title || getFullName(user));
        setShowShareMenu(false);
        setShowQrModal(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка генерации QR");
    }
  };

  // Generate roles from user data
  const generateRoles = useCallback((): RoleTab[] => {
    const roles: RoleTab[] = [];

    // Добавляем основную (личную) визитку первой
    const primaryCard = cards.find((c) => c.is_primary);
    if (primaryCard) {
      roles.push({
        id: primaryCard.id,
        name: "Личный",
        emoji: "🔥",
      });
    }

    // Добавляем остальные визитки
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

  // Get current selected card based on active role
  const getSelectedCard = useCallback((): BusinessCard | null => {
    if (!activeRoleId || cards.length === 0) return null;
    return cards.find((c) => c.id === activeRoleId) || cards[0];
  }, [activeRoleId, cards]);

  // Set initial active role when cards load
  useEffect(() => {
    if (cards.length > 0 && !activeRoleId) {
      const primaryCard = cards.find((c) => c.is_primary);
      if (primaryCard) {
        setActiveRoleId(primaryCard.id);
      } else {
        setActiveRoleId(cards[0].id);
      }
    } else if (cards.length > 0 && !cards.find((c) => c.id === activeRoleId)) {
      // If current activeRoleId is not in cards anymore, reset to primary
      const primaryCard = cards.find((c) => c.is_primary);
      setActiveRoleId(primaryCard?.id || cards[0].id);
    }
  }, [cards, activeRoleId]);

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

  // Get current selected card
  const selectedCard = getSelectedCard();

  // Data from selected card (or user data as fallback)
  const displayName = selectedCard?.display_name || getFullName(user);
  const displayAvatar = selectedCard?.avatar_url || user.avatar_url;
  const displayTags = selectedCard?.tags || user.tags || [];
  const displayContacts = selectedCard?.contacts || user.contacts || [];
  const displaySearchTags = selectedCard?.search_tags || user.search_tags || [];

  // Skills count from selected card
  const skillsCount = displayTags.length || 0;
  // Recommendations count (can be fetched from API later)
  const recommendationsCount = 120;
  // User level (based on card completeness or profile completeness)
  const userLevel =
    Math.floor((selectedCard?.completeness || user.profile_completeness) / 4) +
    1;

  // Extract roles from selected card's tags
  const getCardRoles = (): string[] => {
    const roles: string[] = [];

    // Добавляем title карточки если это не личная
    if (selectedCard && !selectedCard.is_primary && selectedCard.title) {
      roles.push(selectedCard.title);
    }

    // Добавляем теги из карточки
    if (displayTags.length > 0) {
      displayTags.slice(0, 3).forEach((tag) => {
        roles.push(tag.name);
      });
    }

    if (roles.length === 0) {
      roles.push(user.position || "Пользователь");
    }

    return roles;
  };

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
      subtitle: `${displayContacts.length * 10} контактов`,
      variant: "purple" as const,
      onClick: () => {},
    },
  ];

  // Hobbies (from search tags)
  const hobbies =
    displaySearchTags.slice(0, 5).map((tag, i) => ({
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
          if (selectedCard) {
            handleOpenCard(selectedCard);
          }
        }}
        onRightClick={handleShareProfile}
      />

      {/* Content */}
      <div className="profile__content">
        {/* Hero Block - uses selected card data */}
        <ProfileHeroBlock
          name={displayName}
          avatarUrl={displayAvatar}
          roles={getCardRoles()}
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

        {/* Info Card - uses selected card contacts */}
        <ProfileInfoCard
          phone={displayContacts.find((c) => c.type === "phone")?.value}
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

        {/* Add new card button */}
        {cards.length < 5 && (
          <button
            className="profile__add-card"
            onClick={() => setShowCreateModal(true)}
          >
            <span className="profile__add-card-icon">+</span>
            <span className="profile__add-card-text">
              Создать новую визитку
            </span>
          </button>
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

      {/* Share Menu */}
      <ShareMenu
        isOpen={showShareMenu}
        onClose={() => setShowShareMenu(false)}
        cards={cards}
        onShare={handleShareSelectedCards}
        initialSelectedIds={cards.filter((c) => c.is_primary).map((c) => c.id)}
      />

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
