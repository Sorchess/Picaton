import { useState, useCallback, useEffect } from "react";
import type { UserPublic, SearchResult } from "@/entities/user";
import { userApi } from "@/entities/user";
import { UserCard } from "@/entities/user";
import { useAuth } from "@/features/auth";
import { SpecialistModal } from "@/features/specialist-modal";
import { Tag, Loader, Typography } from "@/shared";
import "./SearchPage.scss";

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

  // Загрузить сохранённые контакты
  useEffect(() => {
    if (authUser?.id) {
      loadSavedContacts();
    }
  }, [authUser?.id]);

  const loadSavedContacts = async () => {
    if (!authUser?.id) return;
    try {
      const contacts = await userApi.getContacts(authUser.id);
      const ids = new Set(
        contacts.map((c) => c.saved_user_id).filter(Boolean) as string[]
      );
      setSavedContacts(ids);
    } catch {
      // Игнорируем ошибку загрузки контактов
    }
  };

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

  const handleSaveContactFromModal = async (user: UserPublic) => {
    await handleAddContact(user);
  };

  const handleAddContact = async (user: UserPublic) => {
    if (!authUser?.id) return;
    try {
      await userApi.saveContact(authUser.id, user.id);
      setSavedContacts((prev) => new Set([...prev, user.id]));
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
              Найдено: <span>{results.total_count}</span>
            </h2>
            {results.suggested_tags && results.suggested_tags.length > 0 && (
              <div className="search-page__suggested">
                <span>Похожие:</span>
                {results.suggested_tags.map((tag: string, i: number) => (
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
            {results.users.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                onClick={handleUserClick}
                onAddContact={handleAddContact}
                isSaved={savedContacts.has(user.id)}
                showTags
              />
            ))}
          </div>

          {results.users.length === 0 && (
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
        isSaved={selectedUser ? savedContacts.has(selectedUser.id) : false}
      />
    </div>
  );
}
