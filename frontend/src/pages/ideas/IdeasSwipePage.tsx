import { useState, useEffect, useCallback } from "react";
import {
  ideaApi,
  type Idea,
  type SwipeDirection,
  type IdeaVisibility,
  getAuthorFullName,
} from "@/entities/idea";
import { Typography, Loader, Button, Tag } from "@/shared";
import "./IdeasSwipePage.scss";

const SWIPE_THRESHOLD = 100;

interface SwipeCardProps {
  idea: Idea;
  onSwipe: (direction: SwipeDirection) => void;
  isTop: boolean;
}

function SwipeCard({ idea, onSwipe, isTop }: SwipeCardProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isTop) return;
    setIsDragging(true);
    setStartX(e.clientX);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setOffsetX(e.clientX - startX);
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (offsetX > SWIPE_THRESHOLD) {
      setIsExiting(true);
      setOffsetX(300);
      setTimeout(() => onSwipe("like"), 200);
    } else if (offsetX < -SWIPE_THRESHOLD) {
      setIsExiting(true);
      setOffsetX(-300);
      setTimeout(() => onSwipe("dislike"), 200);
    } else {
      setOffsetX(0);
    }
  };

  const rotate = offsetX * 0.05;
  const likeOpacity = Math.min(1, Math.max(0, offsetX / 100));
  const dislikeOpacity = Math.min(1, Math.max(0, -offsetX / 100));

  return (
    <div
      className={`swipe-card ${isTop ? "swipe-card--top" : ""} ${
        isExiting ? "swipe-card--exiting" : ""
      }`}
      style={{
        transform: `translateX(${offsetX}px) rotate(${rotate}deg) scale(${
          isTop ? 1 : 0.95
        })`,
        opacity: isExiting ? 0 : 1,
        transition: isDragging
          ? "none"
          : "transform 0.3s ease, opacity 0.3s ease",
        zIndex: isTop ? 10 : 1,
        top: isTop ? 0 : 10,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Like/Dislike индикаторы */}
      {isTop && (
        <>
          <div
            className="swipe-indicator swipe-indicator--like"
            style={{ opacity: likeOpacity }}
          >
            ❤️ LIKE
          </div>
          <div
            className="swipe-indicator swipe-indicator--dislike"
            style={{ opacity: dislikeOpacity }}
          >
            ✕ NOPE
          </div>
        </>
      )}

      <div className="swipe-card__content">
        <div className="swipe-card__header">
          <div className="swipe-card__author">
            {idea.author?.avatar_url ? (
              <img
                src={idea.author.avatar_url}
                alt=""
                className="swipe-card__avatar"
              />
            ) : (
              <div className="swipe-card__avatar swipe-card__avatar--placeholder">
                {idea.author?.first_name?.[0] || "?"}
              </div>
            )}
            <span className="swipe-card__author-name">
              {getAuthorFullName(idea)}
            </span>
          </div>
          <div className="swipe-card__stats">
            <span>❤️ {idea.likes_count}</span>
            <span>⭐ {idea.super_likes_count}</span>
          </div>
        </div>

        <Typography variant="h2" className="swipe-card__title">
          {idea.title}
        </Typography>

        <Typography variant="body" className="swipe-card__description">
          {idea.description}
        </Typography>

        {idea.required_skills.length > 0 && (
          <div className="swipe-card__skills">
            <Typography variant="small" className="swipe-card__skills-label">
              Требуемые навыки:
            </Typography>
            <div className="swipe-card__tags">
              {idea.required_skills.slice(0, 8).map((skill) => (
                <Tag key={skill} variant="default">
                  {skill}
                </Tag>
              ))}
              {idea.required_skills.length > 8 && (
                <Tag variant="outline">+{idea.required_skills.length - 8}</Tag>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface IdeasSwipePageProps {
  onNavigate?: (page: "projects") => void;
}

export function IdeasSwipePage({ onNavigate }: IdeasSwipePageProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchInfo, setMatchInfo] = useState<{
    isMatch: boolean;
    userIds: string[];
  } | null>(null);

  // Состояние для подстраниц
  const [subPage, setSubPage] = useState<
    "swipe" | "my" | "new" | "edit" | "team"
  >("swipe");
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);

  const loadIdeas = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await ideaApi.getFeed(20);
      setIdeas(response.ideas);
    } catch (e) {
      setError("Не удалось загрузить идеи");
      console.error("Failed to load ideas:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIdeas();
  }, [loadIdeas]);

  const handleSwipe = async (direction: SwipeDirection) => {
    if (ideas.length === 0) return;

    const currentIdea = ideas[0];

    try {
      const response = await ideaApi.swipe({
        idea_id: currentIdea.id,
        direction,
      });

      // Убираем карточку из стека
      setIdeas((prev) => prev.slice(1));

      // Если матч - показываем уведомление
      if (response.is_match) {
        setMatchInfo({
          isMatch: true,
          userIds: response.match_user_ids,
        });
      }

      // Если карточек мало - подгружаем ещё
      if (ideas.length <= 3) {
        const moreIdeas = await ideaApi.getFeed(20);
        setIdeas((prev) => [...prev, ...moreIdeas.ideas]);
      }
    } catch (e) {
      console.error("Failed to swipe:", e);
    }
  };

  const handleSuperLike = async () => {
    await handleSwipe("super_like");
  };

  const displayedIdeas = ideas.slice(0, 3);

  // Подстраницы
  if (subPage === "my") {
    return (
      <MyIdeasSubPage
        onBack={() => setSubPage("swipe")}
        onEdit={(id) => {
          setSelectedIdeaId(id);
          setSubPage("edit");
        }}
        onFindTeam={(id) => {
          setSelectedIdeaId(id);
          setSubPage("team");
        }}
      />
    );
  }

  if (subPage === "new" || subPage === "edit") {
    return (
      <IdeaFormSubPage
        ideaId={subPage === "edit" ? selectedIdeaId : null}
        onBack={() => {
          setSubPage("swipe");
          setSelectedIdeaId(null);
        }}
        onSaved={() => {
          setSubPage("my");
          setSelectedIdeaId(null);
        }}
      />
    );
  }

  if (subPage === "team" && selectedIdeaId) {
    return (
      <IdeaTeamSubPage
        ideaId={selectedIdeaId}
        onBack={() => {
          setSubPage("my");
          setSelectedIdeaId(null);
        }}
        onProjectCreated={() => onNavigate?.("projects")}
      />
    );
  }

  if (isLoading && ideas.length === 0) {
    return (
      <div className="ideas-swipe-page ideas-swipe-page--loading">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="ideas-swipe-page ideas-swipe-page--error">
        <Typography variant="body">{error}</Typography>
        <Button onClick={loadIdeas}>Попробовать снова</Button>
      </div>
    );
  }

  return (
    <div className="ideas-swipe-page">
      <header className="ideas-swipe-page__header">
        <Typography variant="h1">Идеи</Typography>
        <div className="ideas-swipe-page__nav">
          <Button variant="ghost" onClick={() => setSubPage("my")}>
            Мои идеи
          </Button>
          <Button variant="primary" onClick={() => setSubPage("new")}>
            + Создать
          </Button>
        </div>
      </header>

      <div className="ideas-swipe-page__stack">
        {displayedIdeas.length > 0 ? (
          <>
            {displayedIdeas.map((idea, index) => (
              <SwipeCard
                key={idea.id}
                idea={idea}
                onSwipe={handleSwipe}
                isTop={index === 0}
              />
            ))}
          </>
        ) : (
          <div className="ideas-swipe-page__empty">
            <Typography variant="h2">Идеи закончились! 🎉</Typography>
            <Typography variant="body">
              Вы просмотрели все доступные идеи. Загляните позже или создайте
              свою!
            </Typography>
            <Button onClick={() => setSubPage("new")}>Создать идею</Button>
          </div>
        )}
      </div>

      {displayedIdeas.length > 0 && (
        <div className="ideas-swipe-page__actions">
          <button
            className="swipe-action swipe-action--dislike"
            onClick={() => handleSwipe("dislike")}
            aria-label="Пропустить"
          >
            ✕
          </button>
          <button
            className="swipe-action swipe-action--super"
            onClick={handleSuperLike}
            aria-label="Супер лайк"
          >
            ⭐
          </button>
          <button
            className="swipe-action swipe-action--like"
            onClick={() => handleSwipe("like")}
            aria-label="Нравится"
          >
            ❤️
          </button>
        </div>
      )}

      {/* Модальное окно матча */}
      {matchInfo?.isMatch && (
        <div className="match-modal" onClick={() => setMatchInfo(null)}>
          <div
            className="match-modal__content"
            onClick={(e) => e.stopPropagation()}
          >
            <Typography variant="h1">🎉 Это мэтч!</Typography>
            <Typography variant="body">
              Автор идеи тоже заинтересовался вами. Можете начать общение!
            </Typography>
            <div className="match-modal__actions">
              <Button variant="ghost" onClick={() => setMatchInfo(null)}>
                Продолжить
              </Button>
              <Button
                variant="primary"
                onClick={() => onNavigate?.("projects")}
              >
                К проектам
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ====== Подстраницы ======

interface MyIdeasSubPageProps {
  onBack: () => void;
  onEdit: (id: string) => void;
  onFindTeam: (id: string) => void;
}

function MyIdeasSubPage({ onBack, onEdit, onFindTeam }: MyIdeasSubPageProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "draft" | "active" | "archived">(
    "all"
  );

  useEffect(() => {
    loadMyIdeas();
  }, []);

  const loadMyIdeas = async () => {
    try {
      setIsLoading(true);
      const response = await ideaApi.getMyIdeas();
      setIdeas(response.ideas);
    } catch (e) {
      console.error("Failed to load my ideas:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await ideaApi.publish(id);
      loadMyIdeas();
    } catch (e) {
      console.error("Failed to publish idea:", e);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await ideaApi.archive(id);
      loadMyIdeas();
    } catch (e) {
      console.error("Failed to archive idea:", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить эту идею?")) return;
    try {
      await ideaApi.delete(id);
      loadMyIdeas();
    } catch (e) {
      console.error("Failed to delete idea:", e);
    }
  };

  const handleCreateProject = async (ideaId: string) => {
    try {
      await ideaApi.createProject(ideaId);
      loadMyIdeas();
    } catch (e) {
      console.error("Failed to create project:", e);
    }
  };

  const filteredIdeas = ideas.filter((idea) => {
    if (filter === "all") return true;
    return idea.status === filter;
  });

  if (isLoading) {
    return (
      <div className="my-ideas-page my-ideas-page--loading">
        <Loader />
      </div>
    );
  }

  return (
    <div className="my-ideas-page">
      <header className="my-ideas-page__header">
        <Button variant="ghost" onClick={onBack}>
          ← Назад
        </Button>
        <Typography variant="h1">Мои идеи</Typography>
      </header>

      <div className="my-ideas-page__filters">
        {(["all", "draft", "active", "archived"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "primary" : "ghost"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === "all"
              ? "Все"
              : f === "draft"
              ? "Черновики"
              : f === "active"
              ? "Активные"
              : "Архив"}
          </Button>
        ))}
      </div>

      <div className="my-ideas-page__list">
        {filteredIdeas.length === 0 ? (
          <div className="my-ideas-page__empty">
            <Typography variant="body">У вас пока нет идей</Typography>
          </div>
        ) : (
          filteredIdeas.map((idea) => (
            <div key={idea.id} className="idea-card">
              <div className="idea-card__header">
                <Typography variant="h3">{idea.title}</Typography>
                <Tag variant={idea.status === "active" ? "default" : "outline"}>
                  {idea.status === "draft"
                    ? "Черновик"
                    : idea.status === "active"
                    ? "Активна"
                    : "Архив"}
                </Tag>
              </div>
              <Typography variant="body" className="idea-card__description">
                {idea.description}
              </Typography>
              <div className="idea-card__skills">
                {idea.required_skills.slice(0, 5).map((skill) => (
                  <Tag key={skill} variant="outline" size="sm">
                    {skill}
                  </Tag>
                ))}
                {idea.required_skills.length > 5 && (
                  <Tag variant="outline" size="sm">
                    +{idea.required_skills.length - 5}
                  </Tag>
                )}
              </div>
              <div className="idea-card__actions">
                {idea.status === "draft" && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handlePublish(idea.id)}
                  >
                    Опубликовать
                  </Button>
                )}
                {idea.status === "active" && (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onFindTeam(idea.id)}
                    >
                      Найти команду
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCreateProject(idea.id)}
                    >
                      Создать проект
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(idea.id)}
                >
                  Редактировать
                </Button>
                {idea.status !== "archived" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleArchive(idea.id)}
                  >
                    В архив
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="danger"
                  onClick={() => handleDelete(idea.id)}
                >
                  Удалить
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface IdeaFormSubPageProps {
  ideaId: string | null;
  onBack: () => void;
  onSaved: () => void;
}

function IdeaFormSubPage({ ideaId, onBack, onSaved }: IdeaFormSubPageProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [visibility, setVisibility] = useState<IdeaVisibility>("public");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (ideaId) {
      loadIdea(ideaId);
    }
  }, [ideaId]);

  const loadIdea = async (id: string) => {
    try {
      setIsLoading(true);
      const idea = await ideaApi.getById(id);
      setTitle(idea.title);
      setDescription(idea.description);
      setRequiredSkills(idea.required_skills);
      setVisibility(idea.visibility);
    } catch (e) {
      console.error("Failed to load idea:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSkill = () => {
    const skill = skillInput.trim();
    if (skill && !requiredSkills.includes(skill)) {
      setRequiredSkills([...requiredSkills, skill]);
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setRequiredSkills(requiredSkills.filter((s) => s !== skill));
  };

  const handleSubmit = async (e: React.FormEvent, asDraft = false) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    try {
      setIsSaving(true);
      const data = {
        title,
        description,
        required_skills: requiredSkills,
        visibility,
      };

      if (ideaId) {
        await ideaApi.update(ideaId, data);
      } else {
        const idea = await ideaApi.create(data);
        if (!asDraft) {
          await ideaApi.publish(idea.id);
        }
      }
      onSaved();
    } catch (e) {
      console.error("Failed to save idea:", e);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="idea-form-page idea-form-page--loading">
        <Loader />
      </div>
    );
  }

  return (
    <div className="idea-form-page">
      <header className="idea-form-page__header">
        <Button variant="ghost" onClick={onBack}>
          ← Назад
        </Button>
        <Typography variant="h1">
          {ideaId ? "Редактировать идею" : "Новая идея"}
        </Typography>
      </header>

      <form className="idea-form" onSubmit={(e) => handleSubmit(e, false)}>
        <div className="idea-form__field">
          <Typography variant="subtitle">Название</Typography>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Введите название идеи"
            required
            className="idea-form__input"
          />
        </div>

        <div className="idea-form__field">
          <Typography variant="subtitle">Описание</Typography>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Опишите вашу идею подробно"
            required
            rows={5}
            className="idea-form__textarea"
          />
        </div>

        <div className="idea-form__field">
          <Typography variant="subtitle">Требуемые навыки</Typography>
          <div className="idea-form__skill-input">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              placeholder="Добавьте навык"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddSkill();
                }
              }}
              className="idea-form__input"
            />
            <Button type="button" variant="secondary" onClick={handleAddSkill}>
              Добавить
            </Button>
          </div>
          {requiredSkills.length > 0 && (
            <div className="idea-form__skills">
              {requiredSkills.map((skill) => (
                <Tag key={skill} variant="default">
                  {skill}
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                  >
                    ×
                  </button>
                </Tag>
              ))}
            </div>
          )}
          <Typography variant="small" className="idea-form__hint">
            Укажите навыки, которые нужны для реализации вашей идеи
          </Typography>
        </div>

        <div className="idea-form__field">
          <Typography variant="subtitle">Видимость</Typography>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as IdeaVisibility)}
            className="idea-form__select"
          >
            <option value="public">Публичная</option>
            <option value="connections_only">Только для контактов</option>
            <option value="company">В компании</option>
            <option value="private">Личная</option>
          </select>
        </div>

        <div className="idea-form__actions">
          {!ideaId && (
            <Button
              type="button"
              variant="secondary"
              onClick={(e: React.MouseEvent) =>
                handleSubmit(e as unknown as React.FormEvent, true)
              }
              disabled={isSaving}
            >
              Сохранить как черновик
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={isSaving}>
            {ideaId ? "Сохранить" : "Опубликовать"}
          </Button>
        </div>
      </form>
    </div>
  );
}

interface IdeaTeamSubPageProps {
  ideaId: string;
  onBack: () => void;
  onProjectCreated: () => void;
}

function IdeaTeamSubPage({
  ideaId,
  onBack,
  onProjectCreated,
}: IdeaTeamSubPageProps) {
  const [idea, setIdea] = useState<Idea | null>(null);
  const [analysis, setAnalysis] = useState<{
    recommended_skills: string[];
    priority_skills: string[];
    suggested_roles: string[];
  } | null>(null);
  const [experts, setExperts] = useState<
    Array<{
      user_id: string;
      first_name: string;
      last_name: string;
      avatar_url?: string;
      matching_skills: string[];
      other_skills: string[];
      match_score: number;
      bio?: string;
    }>
  >([]);
  const [selectedExperts, setSelectedExperts] = useState<Set<string>>(
    new Set()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideaId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [ideaData, analysisData, expertsData] = await Promise.all([
        ideaApi.getById(ideaId),
        ideaApi.analyze(ideaId),
        ideaApi.findMatchingExperts(ideaId, { limit: 20 }),
      ]);
      setIdea(ideaData);
      setAnalysis({
        recommended_skills:
          analysisData.recommended_skills || analysisData.skills || [],
        priority_skills: analysisData.priority_skills || [],
        suggested_roles:
          analysisData.suggested_roles || analysisData.roles || [],
      });
      setExperts(expertsData.experts);
    } catch (e) {
      console.error("Failed to load team data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpert = (userId: string) => {
    setSelectedExperts((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleCreateProject = async () => {
    try {
      setIsCreatingProject(true);
      await ideaApi.createProjectWithTeam(ideaId, Array.from(selectedExperts));
      onProjectCreated();
    } catch (e) {
      console.error("Failed to create project:", e);
    } finally {
      setIsCreatingProject(false);
    }
  };

  // Вычисляем покрытие навыков
  const getCoveredSkills = () => {
    const covered = new Set<string>();
    experts
      .filter((e) => selectedExperts.has(e.user_id))
      .forEach((e) => e.matching_skills.forEach((s) => covered.add(s)));
    return covered;
  };

  const getMissingSkills = () => {
    const covered = getCoveredSkills();
    return (analysis?.recommended_skills || []).filter((s) => !covered.has(s));
  };

  if (isLoading) {
    return (
      <div className="idea-team-page idea-team-page--loading">
        <Loader />
      </div>
    );
  }

  return (
    <div className="idea-team-page">
      <header className="idea-team-page__header">
        <Button variant="ghost" onClick={onBack}>
          ← Назад
        </Button>
        <Typography variant="h1">Подбор команды</Typography>
      </header>

      {idea && (
        <div className="idea-team-page__idea">
          <Typography variant="h2">{idea.title}</Typography>
          <Typography variant="body">{idea.description}</Typography>
        </div>
      )}

      {analysis && (
        <div className="idea-team-page__analysis">
          <div className="analysis-section">
            <Typography variant="subtitle">Рекомендуемые навыки</Typography>
            <div className="analysis-section__tags">
              {analysis.recommended_skills.map((skill) => (
                <Tag
                  key={skill}
                  variant={
                    analysis.priority_skills.includes(skill)
                      ? "default"
                      : "outline"
                  }
                >
                  {skill}
                </Tag>
              ))}
            </div>
          </div>

          {analysis.suggested_roles.length > 0 && (
            <div className="analysis-section">
              <Typography variant="subtitle">Рекомендуемые роли</Typography>
              <div className="analysis-section__tags">
                {analysis.suggested_roles.map((role) => (
                  <Tag key={role} variant="outline">
                    {role}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedExperts.size > 0 && (
        <div className="idea-team-page__selected">
          <Typography variant="h3">
            Выбрано экспертов: {selectedExperts.size}
          </Typography>
          {getMissingSkills().length > 0 && (
            <div className="missing-skills">
              <Typography variant="small">Не хватает навыков:</Typography>
              <div className="missing-skills__tags">
                {getMissingSkills().map((skill) => (
                  <Tag key={skill} variant="outline" size="sm">
                    {skill}
                  </Tag>
                ))}
              </div>
            </div>
          )}
          <Button
            variant="primary"
            onClick={handleCreateProject}
            disabled={isCreatingProject}
          >
            {isCreatingProject ? "Создание..." : "Создать проект с командой"}
          </Button>
        </div>
      )}

      <div className="idea-team-page__experts">
        <Typography variant="h3">Подходящие эксперты</Typography>
        {experts.length === 0 ? (
          <Typography variant="body">Подходящие эксперты не найдены</Typography>
        ) : (
          <div className="experts-list">
            {experts.map((expert) => (
              <div
                key={expert.user_id}
                className={`expert-card ${
                  selectedExperts.has(expert.user_id)
                    ? "expert-card--selected"
                    : ""
                }`}
                onClick={() => toggleExpert(expert.user_id)}
              >
                <div className="expert-card__header">
                  {expert.avatar_url ? (
                    <img
                      src={expert.avatar_url}
                      alt=""
                      className="expert-card__avatar"
                    />
                  ) : (
                    <div className="expert-card__avatar expert-card__avatar--placeholder">
                      {expert.first_name[0]}
                    </div>
                  )}
                  <div className="expert-card__info">
                    <Typography variant="h4">
                      {expert.first_name} {expert.last_name}
                    </Typography>
                    <Typography variant="small" className="expert-card__bio">
                      {expert.bio}
                    </Typography>
                  </div>
                  <div className="expert-card__score">
                    {Math.round(expert.match_score * 100)}%
                  </div>
                </div>
                <div className="expert-card__skills">
                  {expert.matching_skills.map((skill) => (
                    <Tag key={skill} variant="default" size="sm">
                      {skill}
                    </Tag>
                  ))}
                  {expert.other_skills.slice(0, 3).map((skill) => (
                    <Tag key={skill} variant="outline" size="sm">
                      {skill}
                    </Tag>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
