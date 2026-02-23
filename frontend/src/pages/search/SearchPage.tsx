import { useState, useCallback, useEffect } from "react";
import type {
  UserPublic,
  SearchResult,
  SearchCardResult,
} from "@/entities/user";
import { userApi } from "@/entities/user";
import { UserCard } from "@/entities/user";
import { useAuth } from "@/features/auth";
import { companyApi, type CompanyWithRole } from "@/entities/company";
import { Tag, Loader, Typography } from "@/shared";
import { useI18n } from "@/shared/config";
import "./SearchPage.scss";

// Адаптер для преобразования SearchCardResult в UserPublic-совместимый объект
function cardToUserLike(
  card: SearchCardResult,
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

interface SearchPageProps {
  onOpenContact?: (user: UserPublic, cardId?: string) => void;
}

export function SearchPage({ onOpenContact }: SearchPageProps) {
  const { t } = useI18n();
  const { user: authUser } = useAuth();

  const POPULAR_TAGS = [
    "Python",
    "React",
    "DevOps",
    "ML",
    t("search.analyticsTag"),
    "Java",
    "TypeScript",
  ];
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedContacts, setSavedContacts] = useState<Set<string>>(new Set());

  // Фильтр по компаниям
  const [myCompanies, setMyCompanies] = useState<CompanyWithRole[]>([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(
    new Set(),
  );

  // Загрузка компаний пользователя
  useEffect(() => {
    async function loadCompanies() {
      try {
        const companies = await companyApi.getMyCompanies();
        setMyCompanies(companies);
      } catch {
        // Игнорируем ошибку, если пользователь не в компаниях
      }
    }
    if (authUser?.id) {
      loadCompanies();
    }
  }, [authUser?.id]);

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
        const companyIds =
          selectedCompanyIds.size > 0
            ? Array.from(selectedCompanyIds)
            : undefined;
        const searchResults = await userApi.search(q, {
          limit: 20,
          company_ids: companyIds,
        });
        setResults(searchResults);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("search.searchError"));
      } finally {
        setIsLoading(false);
      }
    },
    [query, selectedCompanyIds],
  );

  // Переключение выбора компании
  const toggleCompanySelection = (companyId: string) => {
    setSelectedCompanyIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(companyId)) {
        newSet.delete(companyId);
      } else {
        newSet.add(companyId);
      }
      return newSet;
    });
  };

  // Сбросить фильтр по компаниям
  const clearCompanyFilter = () => {
    setSelectedCompanyIds(new Set());
  };

  const handleTagClick = (tag: string) => {
    setQuery(tag);
    handleSearch(tag);
  };

  const handleUserClick = (user: UserPublic) => {
    // Используем навигацию вместо модального окна
    if (onOpenContact) {
      const cardId = (user as UserPublic & { card_id?: string }).card_id;
      onOpenContact(user, cardId);
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
        err instanceof Error ? err.message : t("search.saveContactError"),
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
          {t("search.findTitle")}{" "}
          <span className="search-page__title-accent">
            {t("search.expertAccent")}
          </span>
        </h1>
        <p className="search-page__subtitle">{t("search.subtitle")}</p>

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
              {isLoading ? <Loader /> : t("search.findButton")}
            </button>
          </div>
        </div>

        <div className="search-page__popular">
          <span className="search-page__popular-label">
            {t("search.popular")}
          </span>
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

        {/* Фильтр по компаниям */}
        {myCompanies.length > 0 && (
          <div className="search-page__company-filter">
            <span className="search-page__company-filter-label">
              {t("search.inCompanies")}
            </span>
            <div className="search-page__company-tags">
              {myCompanies.map((item) => (
                <button
                  key={item.company.id}
                  className={`search-page__company-btn ${
                    selectedCompanyIds.has(item.company.id) ? "selected" : ""
                  }`}
                  onClick={() => toggleCompanySelection(item.company.id)}
                >
                  {item.company.name}
                </button>
              ))}
            </div>
          </div>
        )}
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
            <div className="search-page__results-info">
              <h2 className="search-page__results-title">
                {t("search.found")}{" "}
                <span>
                  {
                    results.cards.filter((c) => c.owner_id !== authUser?.id)
                      .length
                  }
                </span>
              </h2>
              {selectedCompanyIds.size > 0 && (
                <div className="search-page__filter-info">
                  <span>{t("search.inCompaniesFilter")}</span>
                  {myCompanies
                    .filter((c) => selectedCompanyIds.has(c.company.id))
                    .map((c) => (
                      <Tag key={c.company.id} size="sm" variant="outline">
                        {c.company.name}
                      </Tag>
                    ))}
                  <button
                    className="search-page__filter-clear-btn"
                    onClick={clearCompanyFilter}
                    title={t("search.resetFilter")}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            {results.expanded_tags && results.expanded_tags.length > 0 && (
              <div className="search-page__suggested">
                <span>{t("search.similar")}</span>
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
              <h3>{t("search.noExperts")}</h3>
              <p>{t("search.tryDifferentQuery")}</p>
            </div>
          )}
        </div>
      )}

      {!results && !error && !isLoading && (
        <div className="search-page__placeholder">
          <span className="search-page__placeholder-icon">👥</span>
          <h3>{t("search.startSearch")}</h3>
          <p>{t("search.enterKeywords")}</p>
        </div>
      )}
    </div>
  );
}
