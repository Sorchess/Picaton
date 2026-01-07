import { useState, useCallback, useEffect } from "react";
import type {
  UserPublic,
  SearchResult,
  SearchCardResult,
} from "@/entities/user";
import { userApi } from "@/entities/user";
import { UserCard } from "@/entities/user";
import { useAuth } from "@/features/auth";
import { SpecialistModal } from "@/features/specialist-modal";
import { Tag, Loader, Typography } from "@/shared";
import "./SearchPage.scss";

// Адаптер для преобразования SearchCardResult в UserPublic-совместимый объект
function cardToUserLike(
  card: SearchCardResult
): UserPublic & { card_id: string } {
  // Используем display_name или имя владельца
  const firstName = card.display_name
    ? card.display_name.split(" ")[0]
    : card.owner_first_name || "";
  const lastName = card.display_name
    ? card.display_name.split(" ").slice(1).join(" ")
    : card.owner_last_name || "";

  return {
    id: card.owner_id, // Используем owner_id для сохранения контактов
    card_id: card.id, // Сохраняем id карточки отдельно
    first_name: firstName,
    last_name: lastName,
    avatar_url: card.avatar_url,
    bio: card.bio,
    ai_generated_bio: card.ai_generated_bio,
    location: null,
    search_tags: card.search_tags,
    tags: [],
    contacts: card.contacts.map((c) => ({
      type: c.type,
      value: c.value,
      is_primary: c.is_primary,
      is_visible: true,
    })),
    position: null,
    profile_completeness: card.completeness,
  };
}

const POPULAR_TAGS = [
  "Python",
  "React",
  "DevOps",
  "ML",
  "Аналитика",
  "Java",
  "TypeScript",
];

export function SearchPage() {
  const { user: authUser } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedContacts, setSavedContacts] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<UserPublic | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadSavedContacts = useCallback(async () => {
    if (!authUser?.id) return;
    try {
      const contacts = await userApi.getContacts(authUser.id);
      // Отслеживаем только saved_card_id для точного определения сохранённых карточек
      const ids = new Set<string>();
      contacts.forEach((c) => {
        // Приоритет card_id - если есть, используем только его
        if (c.saved_card_id) {
          ids.add(c.saved_card_id);
        } else if (c.saved_user_id) {
          // Fallback для старых контактов без card_id
          ids.add(c.saved_user_id);
        }
      });
      setSavedContacts(ids);
    } catch {
      // Игнорируем ошибку загрузки контактов
    }
  }, [authUser?.id]);

  // Загрузить сохранённые контакты
  useEffect(() => {
    if (authUser?.id) {
      loadSavedContacts();
    }
  }, [authUser?.id, loadSavedContacts]);

  const handleSearch = useCallback(
    async (searchQuery?: string) => {
      const q = searchQuery ?? query;
      if (!q.trim()) return;

      setIsLoading(true);
      setError(null);

      try {
        const searchResults = await userApi.search(q, { limit: 20 });
        setResults(searchResults);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка поиска");
      } finally {
        setIsLoading(false);
      }
    },
    [query]
  );

  const handleTagClick = (tag: string) => {
    setQuery(tag);
    handleSearch(tag);
  };

  const handleUserClick = (user: UserPublic) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  const handleSaveContactFromModal = async (
    user: UserPublic & { card_id?: string }
  ) => {
    await handleAddContact(user);
    // Закрываем модальное окно после сохранения
    handleCloseModal();
  };

  const handleDeleteContactFromModal = async (
    user: UserPublic & { card_id?: string }
  ) => {
    if (!authUser?.id) return;
    try {
      // Находим контакт по card_id (приоритет) или user_id
      const contacts = await userApi.getContacts(authUser.id);
      const contactToDelete = contacts.find(
        (c) =>
          (user.card_id && c.saved_card_id === user.card_id) ||
          c.saved_user_id === user.id
      );
      if (contactToDelete) {
        await userApi.deleteContact(contactToDelete.id);
        // Убираем из сохранённых только card_id
        setSavedContacts((prev) => {
          const newSet = new Set(prev);
          if (user.card_id) newSet.delete(user.card_id);
          return newSet;
        });
      }
      handleCloseModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка удаления контакта");
    }
  };

  const handleAddContact = async (user: UserPublic & { card_id?: string }) => {
    if (!authUser?.id) return;
    // Предотвращаем повторное сохранение (проверяем только card_id)
    if (user.card_id && savedContacts.has(user.card_id)) return;
    try {
      // Передаём card_id если он есть (для сохранения конкретной карточки)
      await userApi.saveContact(authUser.id, user.id, user.card_id);
      // Добавляем в сохранённые только card_id
      setSavedContacts((prev) => {
        const newSet = new Set(prev);
        if (user.card_id) newSet.add(user.card_id);
        return newSet;
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка сохранения контакта"
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="search-page">
      <div className="search-page__hero">
        <h1 className="search-page__title">
          Найти <span className="search-page__title-accent">эксперта</span>
        </h1>
        <p className="search-page__subtitle">
          Введите навык или ключевое слово для поиска специалистов
        </p>

        <div className="search-page__search-wrapper">
          <div className="search-page__search-field">
            <svg
              className="search-page__search-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              className="search-page__input"
              placeholder="Python, Machine Learning, React..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className="search-page__search-btn"
              onClick={() => handleSearch()}
              disabled={isLoading || !query.trim()}
            >
              {isLoading ? <Loader /> : "Найти"}
            </button>
          </div>
        </div>

        <div className="search-page__popular">
          <span className="search-page__popular-label">Популярные:</span>
          <div className="search-page__popular-tags">
            {POPULAR_TAGS.map((tag) => (
              <button
                key={tag}
                className="search-page__tag-btn"
                onClick={() => handleTagClick(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="search-page__error">
          <Typography variant="body" color="secondary">
            ⚠️ {error}
          </Typography>
        </div>
      )}

      {results && !isLoading && (
        <div className="search-page__results">
          <div className="search-page__results-header">
            <h2 className="search-page__results-title">
              Найдено:{" "}
              <span>
                {
                  results.cards.filter((c) => c.owner_id !== authUser?.id)
                    .length
                }
              </span>
            </h2>
            {results.expanded_tags && results.expanded_tags.length > 0 && (
              <div className="search-page__suggested">
                <span>Похожие:</span>
                {results.expanded_tags
                  .slice(0, 5)
                  .map((tag: string, i: number) => (
                    <Tag
                      key={i}
                      size="sm"
                      onClick={() => handleTagClick(tag)}
                      style={{ cursor: "pointer" }}
                    >
                      {tag}
                    </Tag>
                  ))}
              </div>
            )}
          </div>

          <div className="search-page__grid">
            {results.cards
              .filter((card) => card.owner_id !== authUser?.id)
              .map((card) => {
                const userLike = cardToUserLike(card);
                // Проверяем сохранена ли карточка только по card.id (не по owner_id)
                const isSaved = savedContacts.has(card.id);
                return (
                  <UserCard
                    key={card.id}
                    user={userLike}
                    onClick={handleUserClick}
                    onAddContact={handleAddContact}
                    isSaved={isSaved}
                    showTags
                  />
                );
              })}
          </div>

          {results.cards.length === 0 && (
            <div className="search-page__empty">
              <span className="search-page__empty-icon">🔍</span>
              <h3>Эксперты не найдены</h3>
              <p>Попробуйте изменить поисковый запрос</p>
            </div>
          )}
        </div>
      )}

      {!results && !error && !isLoading && (
        <div className="search-page__placeholder">
          <span className="search-page__placeholder-icon">👥</span>
          <h3>Начните поиск экспертов</h3>
          <p>Введите ключевые слова или выберите из популярных тегов</p>
        </div>
      )}

      <SpecialistModal
        user={selectedUser}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSaveContact={handleSaveContactFromModal}
        onDeleteContact={handleDeleteContactFromModal}
        isSaved={
          selectedUser
            ? savedContacts.has(selectedUser.id) ||
              (selectedUser as UserPublic & { card_id?: string }).card_id
              ? savedContacts.has(
                  (selectedUser as UserPublic & { card_id?: string }).card_id!
                )
              : false
            : false
        }
      />
    </div>
  );
}
