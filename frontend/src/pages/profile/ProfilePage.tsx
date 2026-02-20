import { useState, useEffect, useCallback } from "react";
import type { User } from "@/entities/user";
import { getFullName } from "@/entities/user";
import { userApi } from "@/entities/user";
import type { BusinessCard } from "@/entities/business-card";
import { businessCardApi } from "@/entities/business-card";
import type { CompanyCardAssignment } from "@/entities/company";
import { companyApi } from "@/entities/company";
import { useAuth } from "@/features/auth";
import { endorsementApi } from "@/api/endorsementApi";
import type { SkillWithEndorsements } from "@/api/endorsementApi";
import { Loader, Button, Modal } from "@/shared";
import {
  CardEditor,
  ProfileHeroBlock,
  RoleTabs,
  ProfileInfoCard,
  ProfileTopBar,
} from "./components";
import type { ContactAvatarData } from "./components/ProfileTopBar/ProfileTopBar";
import type { RoleTab } from "./components";
import "./ProfilePage.scss";

type ViewMode = "overview" | "edit-card";

interface ProfilePageProps {
  onShareContact?: (cards: BusinessCard[]) => void;
  /** Card to open in edit mode on mount */
  openCardId?: string;
  /** Callback when card is opened (to clear openCardId) */
  onCardOpened?: () => void;
  /** Navigate to contacts page */
  onNavigateToContacts?: () => void;
  /** Navigate to notifications page */
  onOpenNotifications?: () => void;
}

export function ProfilePage({
  onShareContact,
  openCardId,
  onCardOpened,
  onNavigateToContacts,
  onOpenNotifications,
}: ProfilePageProps) {
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
  const [newCardTitle, setNewCardTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Active role for tabs
  const [activeRoleId, setActiveRoleId] = useState("personal");

  // Skills with endorsements for selected card
  const [skillsWithEndorsements, setSkillsWithEndorsements] = useState<
    SkillWithEndorsements[]
  >([]);

  // Company names for tags
  const [myCompanyNames, setMyCompanyNames] = useState<string[]>([]);

  // Saved contacts count & avatars
  const [savedContactsCount, setSavedContactsCount] = useState<number>(0);
  const [savedContactAvatars, setSavedContactAvatars] = useState<
    ContactAvatarData[]
  >([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

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

  const loadMyCompanies = useCallback(async () => {
    try {
      const companies = await companyApi.getMyCompanies();
      setMyCompanyNames(companies.map((c) => c.company.name));
    } catch {
      // Ignore errors
    }
  }, []);

  const loadSavedContactsCount = useCallback(async () => {
    if (!authUser?.id) return;
    try {
      const contacts = await userApi.getContacts(authUser.id);
      const filtered = contacts.filter((c) => c.saved_user_id !== authUser.id);
      setSavedContactsCount(filtered.length);
      const avatars: ContactAvatarData[] = filtered.slice(0, 5).map((c) => ({
        avatarUrl: c.avatar_url || null,
        initials:
          [c.first_name?.[0], c.last_name?.[0]]
            .filter(Boolean)
            .join("")
            .toUpperCase() ||
          c.name?.[0]?.toUpperCase() ||
          "?",
      }));
      setSavedContactAvatars(avatars);
    } catch {
      // Ignore errors
    }
  }, [authUser?.id]);

  const loadUnreadNotifCount = useCallback(async () => {
    if (!authUser?.id) return;
    try {
      const { count } = await userApi.getUnreadNotificationsCount(authUser.id);
      setUnreadNotifCount(count);
    } catch {
      // Ignore errors
    }
  }, [authUser?.id]);

  // Get current selected card based on active role
  const getSelectedCard = useCallback((): BusinessCard | null => {
    if (!activeRoleId || cards.length === 0) return null;
    return cards.find((c) => c.id === activeRoleId) || cards[0];
  }, [activeRoleId, cards]);

  // Load endorsements for selected card
  const loadEndorsements = useCallback(async () => {
    const card = getSelectedCard();
    if (!card || !authUser?.id) {
      setSkillsWithEndorsements([]);
      return;
    }
    try {
      const data = await endorsementApi.getCardSkills(card.id, authUser.id);
      setSkillsWithEndorsements(data.skills);
    } catch (error) {
      console.error("Failed to load endorsements:", error);
      setSkillsWithEndorsements([]);
    }
  }, [authUser?.id, getSelectedCard]);

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
    loadMyCompanies();
    loadSavedContactsCount();
    loadUnreadNotifCount();
  }, [
    loadUser,
    loadCards,
    loadCardAssignments,
    loadMyCompanies,
    loadSavedContactsCount,
    loadUnreadNotifCount,
  ]);

  // Load endorsements when selected card changes
  useEffect(() => {
    loadEndorsements();
  }, [loadEndorsements]);

  // Open card from prop on mount
  useEffect(() => {
    if (openCardId && cards.length > 0) {
      const cardToOpen = cards.find((c) => c.id === openCardId);
      if (cardToOpen) {
        setEditingCard(cardToOpen);
        setViewMode("edit-card");
        // Clear openCardId after opening
        onCardOpened?.();
      }
    }
  }, [openCardId, cards, onCardOpened]);

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

  // Открыть страницу шаринга визиток
  const handleShareProfile = () => {
    if (!user || cards.length === 0) return;
    onShareContact?.(cards);
  };

  // Generate roles from user data
  const generateRoles = useCallback((): RoleTab[] => {
    const roles: RoleTab[] = [];

    // Добавляем основную (личную) визитку первой
    const primaryCard = cards.find((c) => c.is_primary);
    if (primaryCard) {
      roles.push({
        id: primaryCard.id,
        name: primaryCard.title || "Личный",
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
        onUserUpdate={setUser}
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

  const skillsCount = displaySearchTags.length || 0;

  // Calculate total likes from all skills with endorsements
  const totalLikesCount = skillsWithEndorsements.reduce(
    (sum, skill) => sum + skill.endorsement_count,
    0,
  );

  // Extract roles from selected card's tags
  const getCardRoles = (): string[] => {
    const roles: string[] = [];

    // Добавляем должность пользователя
    if (user.position) {
      roles.push(user.position);
    }

    // Добавляем теги из карточки
    if (displayTags.length > 0) {
      displayTags.slice(0, 3).forEach((tag) => {
        roles.push(tag.name);
      });
    }

    if (roles.length === 0) {
      roles.push("Пользователь");
    }

    return roles;
  };

  const tags =
    displaySearchTags.slice(0, 5).map((tag, i) => ({
      id: `tag-${i}`,
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
        onRightClick={onOpenNotifications}
        contactsCount={savedContactsCount}
        contactAvatars={savedContactAvatars}
        onContactsClick={onNavigateToContacts}
        unreadCount={unreadNotifCount}
      />

      {/* Content */}
      <div className="profile__content">
        {/* Hero Block - uses selected card data */}
        <ProfileHeroBlock
          name={displayName}
          avatarUrl={displayAvatar}
          roles={getCardRoles()}
          username={user.username}
          skillsCount={skillsCount}
          likesCount={totalLikesCount}
          emojis={selectedCard?.emojis}
        />

        {/* Role Tabs */}
        <RoleTabs
          roles={generateRoles()}
          activeRoleId={activeRoleId}
          onChange={setActiveRoleId}
        />

        {/* Info Card - uses selected card contacts */}
        <ProfileInfoCard
          bio={selectedCard?.bio || selectedCard?.ai_generated_bio || undefined}
          contacts={displayContacts}
          tags={tags}
          skillsWithEndorsements={skillsWithEndorsements}
          companyNames={myCompanyNames}
          phone={displayContacts.find((c) => c.type === "phone")?.value}
          username={user.telegram_username || undefined}
          userHandle={user.username}
          onUsernameClick={() => {
            if (user.telegram_username) {
              navigator.clipboard.writeText(`@${user.telegram_username}`);
            }
          }}
          onShareClick={handleShareProfile}
          birthDate={formatBirthDate(user.created_at)}
        />

        {/* Add new card button */}
        {cards.length < 5 && (
          <button
            className="profile__add-card"
            onClick={() => setShowCreateModal(true)}
          >
            <span className="profile__add-card-icon"></span>
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
    </div>
  );
}
