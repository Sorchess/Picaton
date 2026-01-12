import { useState, useEffect, useCallback, useRef } from "react";
import {
  ideaApi,
  type Idea,
  type SwipeDirection,
  type IdeaVisibility,
  type UserGamification,
  type LeaderboardEntry,
  type LeaderboardIdea,
  getAuthorFullName,
  getBadgeLabel,
} from "@/entities/idea";
import {
  projectApi,
  type Project,
  type ProjectMember,
  type Invitation,
} from "@/entities/project";
import { chatApi, ChatWebSocket, type ChatMessage } from "@/entities/chat";
import { useAuth } from "@/features/auth";
import { Typography, Loader, Button, Tag } from "@/shared";
import "./CollaborationPage.scss";

// ============ Типы ============

type MainTab = "feed" | "ideas" | "projects" | "leaderboard";
type IdeaFilter = "all" | "draft" | "active" | "archived";
type ProjectTab = "list" | "invitations";

// ============ Константы ============

const SWIPE_THRESHOLD = 100;

// ============ Главный компонент ============

export function CollaborationPage() {
  const [mainTab, setMainTab] = useState<MainTab>("feed");

  // Состояния для детальных страниц
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [isCreatingIdea, setIsCreatingIdea] = useState(false);
  const [isEditingIdea, setIsEditingIdea] = useState(false);
  const [isFindingTeam, setIsFindingTeam] = useState(false);

  // Навигация к подстраницам
  const openIdeaForm = (ideaId?: string) => {
    setSelectedIdeaId(ideaId || null);
    setIsCreatingIdea(!ideaId);
    setIsEditingIdea(!!ideaId);
  };

  const openTeamFinder = (ideaId: string) => {
    setSelectedIdeaId(ideaId);
    setIsFindingTeam(true);
  };

  const closeSubPage = () => {
    setSelectedIdeaId(null);
    setSelectedProjectId(null);
    setIsCreatingIdea(false);
    setIsEditingIdea(false);
    setIsFindingTeam(false);
  };

  const goToProjects = () => {
    closeSubPage();
    setMainTab("projects");
  };

  // Подстраницы
  if (isCreatingIdea || isEditingIdea) {
    return (
      <IdeaFormView
        ideaId={selectedIdeaId}
        onBack={closeSubPage}
        onSaved={() => {
          closeSubPage();
          setMainTab("ideas");
        }}
      />
    );
  }

  if (isFindingTeam && selectedIdeaId) {
    return (
      <TeamFinderView
        ideaId={selectedIdeaId}
        onBack={closeSubPage}
        onProjectCreated={goToProjects}
      />
    );
  }

  if (selectedProjectId) {
    return (
      <ProjectDetailView projectId={selectedProjectId} onBack={closeSubPage} />
    );
  }

  return (
    <div className="collab-page">
      {/* Заголовок с табами */}
      <header className="collab-page__header">
        <nav className="collab-page__tabs">
          <button
            className={`collab-tab ${
              mainTab === "feed" ? "collab-tab--active" : ""
            }`}
            onClick={() => setMainTab("feed")}
          >
            <span className="collab-tab__icon">🔥</span>
            <span className="collab-tab__label">Лента</span>
          </button>
          <button
            className={`collab-tab ${
              mainTab === "ideas" ? "collab-tab--active" : ""
            }`}
            onClick={() => setMainTab("ideas")}
          >
            <span className="collab-tab__icon">💡</span>
            <span className="collab-tab__label">Мои идеи</span>
          </button>
          <button
            className={`collab-tab ${
              mainTab === "projects" ? "collab-tab--active" : ""
            }`}
            onClick={() => setMainTab("projects")}
          >
            <span className="collab-tab__icon">📁</span>
            <span className="collab-tab__label">Проекты</span>
          </button>
          <button
            className={`collab-tab ${
              mainTab === "leaderboard" ? "collab-tab--active" : ""
            }`}
            onClick={() => setMainTab("leaderboard")}
          >
            <span className="collab-tab__icon">🏆</span>
            <span className="collab-tab__label">Рейтинг</span>
          </button>
        </nav>
      </header>

      {/* Контент табов */}
      <main className="collab-page__content">
        {mainTab === "feed" && (
          <FeedSection
            onCreateIdea={() => openIdeaForm()}
            onMatchNavigate={goToProjects}
          />
        )}
        {mainTab === "ideas" && (
          <MyIdeasSection
            onCreateIdea={() => openIdeaForm()}
            onEditIdea={(id) => openIdeaForm(id)}
            onFindTeam={(id) => openTeamFinder(id)}
          />
        )}
        {mainTab === "projects" && (
          <ProjectsSection onOpenProject={(id) => setSelectedProjectId(id)} />
        )}
        {mainTab === "leaderboard" && <LeaderboardSection />}
      </main>
    </div>
  );
}

// ============ Секция ленты (свайп) ============

interface FeedSectionProps {
  onCreateIdea: () => void;
  onMatchNavigate: () => void;
}

function FeedSection({ onCreateIdea, onMatchNavigate }: FeedSectionProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchInfo, setMatchInfo] = useState<{
    isMatch: boolean;
    userIds: string[];
  } | null>(null);

  // Gamification state
  const [swipeResult, setSwipeResult] = useState<{
    points: number;
    badges: string[];
    streak: number;
  } | null>(null);
  const [viewStartTime, setViewStartTime] = useState<number>(Date.now());

  const loadIdeas = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await ideaApi.getFeed(20);
      setIdeas(response.ideas);
      setViewStartTime(Date.now()); // Reset timer when loading new ideas
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

    // Calculate engagement time
    const engagementTime = Math.min(
      Math.floor((Date.now() - viewStartTime) / 1000),
      600 // Max 10 minutes
    );

    try {
      const response = await ideaApi.swipe({
        idea_id: currentIdea.id,
        direction,
        engagement_time_seconds: engagementTime,
      });

      setIdeas((prev) => prev.slice(1));
      setViewStartTime(Date.now()); // Reset for next card

      // Show gamification feedback
      if (response.points_earned > 0 || response.new_badges.length > 0) {
        setSwipeResult({
          points: response.points_earned,
          badges: response.new_badges,
          streak: response.current_streak,
        });
        // Auto-hide after 2 seconds
        setTimeout(() => setSwipeResult(null), 2000);
      }

      if (response.is_match) {
        setMatchInfo({ isMatch: true, userIds: response.match_user_ids });
      }

      if (ideas.length <= 3) {
        const moreIdeas = await ideaApi.getFeed(20);
        setIdeas((prev) => [...prev, ...moreIdeas.ideas]);
      }
    } catch (e) {
      console.error("Failed to swipe:", e);
    }
  };

  if (isLoading && ideas.length === 0) {
    return (
      <div className="feed-section feed-section--loading">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="feed-section feed-section--error">
        <Typography variant="body">{error}</Typography>
        <Button onClick={loadIdeas}>Попробовать снова</Button>
      </div>
    );
  }

  const displayedIdeas = ideas.slice(0, 3);

  return (
    <div className="feed-section">
      <div className="feed-section__cards">
        {displayedIdeas.length > 0 ? (
          displayedIdeas.map((idea, index) => (
            <SwipeCard
              key={idea.id}
              idea={idea}
              onSwipe={handleSwipe}
              isTop={index === 0}
            />
          ))
        ) : (
          <EmptyFeed onCreateIdea={onCreateIdea} />
        )}
      </div>

      {displayedIdeas.length > 0 && (
        <div className="feed-section__actions">
          <button
            className="action-btn action-btn--dislike"
            onClick={() => handleSwipe("dislike")}
            aria-label="Пропустить"
          >
            <span>✕</span>
          </button>
          <button
            className="action-btn action-btn--super"
            onClick={() => handleSwipe("super_like")}
            aria-label="Супер лайк"
          >
            <span>⭐</span>
          </button>
          <button
            className="action-btn action-btn--like"
            onClick={() => handleSwipe("like")}
            aria-label="Нравится"
          >
            <span>❤️</span>
          </button>
        </div>
      )}

      {matchInfo?.isMatch && (
        <MatchModal
          onContinue={() => setMatchInfo(null)}
          onGoToProjects={onMatchNavigate}
        />
      )}

      {/* Gamification feedback */}
      {swipeResult && (
        <div className="gamification-toast">
          <div className="gamification-toast__content">
            {swipeResult.points > 0 && (
              <span className="gamification-toast__points">
                +{swipeResult.points} ✨
              </span>
            )}
            {swipeResult.streak > 1 && (
              <span className="gamification-toast__streak">
                🔥 {swipeResult.streak} дней подряд!
              </span>
            )}
            {swipeResult.badges.map((badge) => (
              <span key={badge} className="gamification-toast__badge">
                🏆 Новый бейдж: {badge}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Свайп карточка ============

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
      setOffsetX(400);
      setTimeout(() => onSwipe("like"), 200);
    } else if (offsetX < -SWIPE_THRESHOLD) {
      setIsExiting(true);
      setOffsetX(-400);
      setTimeout(() => onSwipe("dislike"), 200);
    } else {
      setOffsetX(0);
    }
  };

  const rotate = offsetX * 0.04;
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

      <div className="swipe-card__body">
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
              {idea.required_skills.slice(0, 6).map((skill) => (
                <Tag key={skill} variant="outline" size="sm">
                  {skill}
                </Tag>
              ))}
              {idea.required_skills.length > 6 && (
                <Tag variant="outline" size="sm">
                  +{idea.required_skills.length - 6}
                </Tag>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Пустая лента ============

function EmptyFeed({ onCreateIdea }: { onCreateIdea: () => void }) {
  return (
    <div className="empty-feed">
      <div className="empty-feed__icon">🎉</div>
      <Typography variant="h2">Идеи закончились!</Typography>
      <Typography variant="body">
        Вы просмотрели все доступные идеи. Загляните позже или создайте свою!
      </Typography>
      <Button variant="primary" onClick={onCreateIdea}>
        Создать идею
      </Button>
    </div>
  );
}

// ============ Модальное окно матча ============

interface MatchModalProps {
  onContinue: () => void;
  onGoToProjects: () => void;
}

function MatchModal({ onContinue, onGoToProjects }: MatchModalProps) {
  return (
    <div className="match-modal" onClick={onContinue}>
      <div
        className="match-modal__content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="match-modal__icon">🎉</div>
        <Typography variant="h1">Это мэтч!</Typography>
        <Typography variant="body">
          Автор идеи тоже заинтересовался вами. Можете начать общение!
        </Typography>
        <div className="match-modal__actions">
          <Button variant="ghost" onClick={onContinue}>
            Продолжить
          </Button>
          <Button variant="primary" onClick={onGoToProjects}>
            К проектам
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============ Секция "Мои идеи" ============

interface MyIdeasSectionProps {
  onCreateIdea: () => void;
  onEditIdea: (id: string) => void;
  onFindTeam: (id: string) => void;
}

function MyIdeasSection({
  onCreateIdea,
  onEditIdea,
  onFindTeam,
}: MyIdeasSectionProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<IdeaFilter>("all");

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
      console.error("Failed to publish:", e);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await ideaApi.archive(id);
      loadMyIdeas();
    } catch (e) {
      console.error("Failed to archive:", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить эту идею?")) return;
    try {
      await ideaApi.delete(id);
      loadMyIdeas();
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  };

  const filteredIdeas = ideas.filter((idea) => {
    if (filter === "all") return true;
    return idea.status === filter;
  });

  if (isLoading) {
    return (
      <div className="ideas-section ideas-section--loading">
        <Loader />
      </div>
    );
  }

  return (
    <div className="ideas-section">
      <div className="ideas-section__toolbar">
        <div className="ideas-section__filters">
          {(["all", "draft", "active", "archived"] as const).map((f) => (
            <button
              key={f}
              className={`filter-btn ${
                filter === f ? "filter-btn--active" : ""
              }`}
              onClick={() => setFilter(f)}
            >
              {f === "all"
                ? "Все"
                : f === "draft"
                ? "Черновики"
                : f === "active"
                ? "Активные"
                : "Архив"}
            </button>
          ))}
        </div>
        <Button variant="primary" onClick={onCreateIdea}>
          + Создать идею
        </Button>
      </div>

      <div className="ideas-section__list">
        {filteredIdeas.length === 0 ? (
          <div className="ideas-section__empty">
            <Typography variant="body">
              {filter === "all"
                ? "У вас пока нет идей"
                : `Нет идей со статусом "${filter}"`}
            </Typography>
            {filter === "all" && (
              <Button variant="secondary" onClick={onCreateIdea}>
                Создать первую идею
              </Button>
            )}
          </div>
        ) : (
          filteredIdeas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onEdit={() => onEditIdea(idea.id)}
              onPublish={() => handlePublish(idea.id)}
              onArchive={() => handleArchive(idea.id)}
              onDelete={() => handleDelete(idea.id)}
              onFindTeam={() => onFindTeam(idea.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============ Карточка идеи ============

interface IdeaCardProps {
  idea: Idea;
  onEdit: () => void;
  onPublish: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onFindTeam: () => void;
}

function IdeaCard({
  idea,
  onEdit,
  onPublish,
  onArchive,
  onDelete,
  onFindTeam,
}: IdeaCardProps) {
  return (
    <div className="idea-card">
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

      {idea.required_skills.length > 0 && (
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
      )}

      <div className="idea-card__stats">
        <span>❤️ {idea.likes_count}</span>
        <span>⭐ {idea.super_likes_count}</span>
        <span>👁️ {idea.views_count || 0}</span>
      </div>

      <div className="idea-card__actions">
        {idea.status === "draft" && (
          <Button variant="primary" size="sm" onClick={onPublish}>
            Опубликовать
          </Button>
        )}
        {idea.status === "active" && (
          <Button variant="primary" size="sm" onClick={onFindTeam}>
            🚀 Найти команду
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Редактировать
        </Button>
        {idea.status !== "archived" && (
          <Button variant="ghost" size="sm" onClick={onArchive}>
            В архив
          </Button>
        )}
        <Button variant="ghost" size="sm" className="danger" onClick={onDelete}>
          Удалить
        </Button>
      </div>
    </div>
  );
}

// ============ Секция "Проекты" ============

interface ProjectsSectionProps {
  onOpenProject: (id: string) => void;
}

function ProjectsSection({ onOpenProject }: ProjectsSectionProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<ProjectTab>("list");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [projectsData, invitationsData] = await Promise.all([
        projectApi.getMyProjects(),
        projectApi.getMyInvitations(),
      ]);
      setProjects(projectsData.projects);
      setInvitations(invitationsData);
    } catch (e) {
      console.error("Failed to load projects:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    try {
      await projectApi.respondToInvitation(invitationId, true);
      loadData();
    } catch (e) {
      console.error("Failed to accept invitation:", e);
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      await projectApi.respondToInvitation(invitationId, false);
      loadData();
    } catch (e) {
      console.error("Failed to decline invitation:", e);
    }
  };

  if (isLoading) {
    return (
      <div className="projects-section projects-section--loading">
        <Loader />
      </div>
    );
  }

  return (
    <div className="projects-section">
      <div className="projects-section__tabs">
        <button
          className={`tab-btn ${tab === "list" ? "tab-btn--active" : ""}`}
          onClick={() => setTab("list")}
        >
          Мои проекты
          {projects.length > 0 && (
            <span className="tab-btn__badge">{projects.length}</span>
          )}
        </button>
        <button
          className={`tab-btn ${
            tab === "invitations" ? "tab-btn--active" : ""
          }`}
          onClick={() => setTab("invitations")}
        >
          Приглашения
          {invitations.length > 0 && (
            <span className="tab-btn__badge tab-btn__badge--accent">
              {invitations.length}
            </span>
          )}
        </button>
      </div>

      {tab === "list" && (
        <div className="projects-section__list">
          {projects.length === 0 ? (
            <div className="projects-section__empty">
              <Typography variant="body">У вас пока нет проектов</Typography>
              <Typography variant="small">
                Создайте идею и соберите команду, или примите приглашение
              </Typography>
            </div>
          ) : (
            projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => onOpenProject(project.id)}
              />
            ))
          )}
        </div>
      )}

      {tab === "invitations" && (
        <div className="projects-section__invitations">
          {invitations.length === 0 ? (
            <div className="projects-section__empty">
              <Typography variant="body">Нет приглашений</Typography>
            </div>
          ) : (
            invitations.map((invitation) => (
              <InvitationCard
                key={invitation.id}
                invitation={invitation}
                onAccept={() => handleAcceptInvitation(invitation.id)}
                onDecline={() => handleDeclineInvitation(invitation.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============ Карточка проекта ============

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <div className="project-card" onClick={onClick}>
      <div className="project-card__header">
        <Typography variant="h3">{project.name}</Typography>
        <Tag variant={project.status === "active" ? "default" : "outline"}>
          {project.status === "active"
            ? "Активен"
            : project.status === "completed"
            ? "Завершён"
            : "Архив"}
        </Tag>
      </div>
      <Typography variant="body" className="project-card__description">
        {project.description}
      </Typography>
      <div className="project-card__meta">
        <span className="project-card__members">
          👥 {project.members_count} участников
        </span>
        {project.unread_messages_count > 0 && (
          <span className="project-card__unread">
            💬 {project.unread_messages_count} новых
          </span>
        )}
      </div>
    </div>
  );
}

// ============ Карточка приглашения ============

interface InvitationCardProps {
  invitation: Invitation;
  onAccept: () => void;
  onDecline: () => void;
}

function InvitationCard({
  invitation,
  onAccept,
  onDecline,
}: InvitationCardProps) {
  return (
    <div className="invitation-card">
      <div className="invitation-card__header">
        <Typography variant="h3">{invitation.project_name}</Typography>
        <Typography variant="small">
          от {invitation.inviter_name || "Неизвестный"}
        </Typography>
      </div>
      {invitation.message && (
        <Typography variant="small" className="invitation-card__message">
          {invitation.message}
        </Typography>
      )}
      <div className="invitation-card__actions">
        <Button variant="primary" size="sm" onClick={onAccept}>
          Принять
        </Button>
        <Button variant="ghost" size="sm" onClick={onDecline}>
          Отклонить
        </Button>
      </div>
    </div>
  );
}

// ============ Форма создания/редактирования идеи ============

interface IdeaFormViewProps {
  ideaId: string | null;
  onBack: () => void;
  onSaved: () => void;
}

function IdeaFormView({ ideaId, onBack, onSaved }: IdeaFormViewProps) {
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

  const handleSubmit = async (asDraft = false) => {
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
      <div className="idea-form-view idea-form-view--loading">
        <Loader />
      </div>
    );
  }

  return (
    <div className="idea-form-view">
      <header className="subpage-header">
        <button className="back-btn" onClick={onBack}>
          ← Назад
        </button>
        <Typography variant="h1">
          {ideaId ? "Редактировать идею" : "Новая идея"}
        </Typography>
      </header>

      <form
        className="idea-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(false);
        }}
      >
        <div className="form-field">
          <label className="form-field__label">Название</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Введите название идеи"
            required
            className="form-field__input"
          />
        </div>

        <div className="form-field">
          <label className="form-field__label">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Опишите вашу идею подробно..."
            required
            rows={5}
            className="form-field__textarea"
          />
        </div>

        <div className="form-field">
          <label className="form-field__label">Требуемые навыки</label>
          <div className="skill-input-row">
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
              className="form-field__input"
            />
            <Button type="button" variant="secondary" onClick={handleAddSkill}>
              +
            </Button>
          </div>
          {requiredSkills.length > 0 && (
            <div className="skills-list">
              {requiredSkills.map((skill) => (
                <Tag key={skill} variant="default">
                  {skill}
                  <button
                    type="button"
                    className="skill-remove"
                    onClick={() => handleRemoveSkill(skill)}
                  >
                    ×
                  </button>
                </Tag>
              ))}
            </div>
          )}
        </div>

        <div className="form-field">
          <label className="form-field__label">Видимость</label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as IdeaVisibility)}
            className="form-field__select"
          >
            <option value="public">🌍 Публичная</option>
            <option value="connections_only">👥 Только для контактов</option>
            <option value="company">🏢 В компании</option>
            <option value="private">🔒 Личная</option>
          </select>
        </div>

        <div className="form-actions">
          {!ideaId && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleSubmit(true)}
              disabled={isSaving}
            >
              Сохранить черновик
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? "Сохранение..." : ideaId ? "Сохранить" : "Опубликовать"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ============ Поиск команды ============

interface TeamFinderViewProps {
  ideaId: string;
  onBack: () => void;
  onProjectCreated: () => void;
}

function TeamFinderView({
  ideaId,
  onBack,
  onProjectCreated,
}: TeamFinderViewProps) {
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
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
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
      <div className="team-finder team-finder--loading">
        <Loader />
      </div>
    );
  }

  return (
    <div className="team-finder">
      <header className="subpage-header">
        <button className="back-btn" onClick={onBack}>
          ← Назад
        </button>
        <Typography variant="h1">Подбор команды</Typography>
      </header>

      {idea && (
        <div className="team-finder__idea">
          <Typography variant="h2">{idea.title}</Typography>
          <Typography variant="body">{idea.description}</Typography>
        </div>
      )}

      {analysis && (
        <div className="team-finder__analysis">
          <div className="analysis-block">
            <Typography variant="subtitle">Рекомендуемые навыки</Typography>
            <div className="analysis-block__tags">
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
            <div className="analysis-block">
              <Typography variant="subtitle">Рекомендуемые роли</Typography>
              <div className="analysis-block__tags">
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
        <div className="team-finder__selection">
          <div className="selection-info">
            <Typography variant="h3">
              Выбрано: {selectedExperts.size}
            </Typography>
            {getMissingSkills().length > 0 && (
              <div className="missing-skills">
                <Typography variant="small">Не хватает:</Typography>
                {getMissingSkills()
                  .slice(0, 3)
                  .map((skill) => (
                    <Tag key={skill} variant="outline" size="sm">
                      {skill}
                    </Tag>
                  ))}
              </div>
            )}
          </div>
          <Button
            variant="primary"
            onClick={handleCreateProject}
            disabled={isCreatingProject}
          >
            {isCreatingProject ? "Создание..." : "🚀 Создать проект"}
          </Button>
        </div>
      )}

      <div className="team-finder__experts">
        <Typography variant="h3">Подходящие эксперты</Typography>
        {experts.length === 0 ? (
          <Typography variant="body">Подходящие эксперты не найдены</Typography>
        ) : (
          <div className="experts-grid">
            {experts.map((expert) => (
              <ExpertCard
                key={expert.user_id}
                expert={expert}
                isSelected={selectedExperts.has(expert.user_id)}
                onToggle={() => toggleExpert(expert.user_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Карточка эксперта ============

interface ExpertCardProps {
  expert: {
    user_id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    matching_skills: string[];
    other_skills: string[];
    match_score: number;
    bio?: string;
  };
  isSelected: boolean;
  onToggle: () => void;
}

function ExpertCard({ expert, isSelected, onToggle }: ExpertCardProps) {
  return (
    <div
      className={`expert-card ${isSelected ? "expert-card--selected" : ""}`}
      onClick={onToggle}
    >
      <div className="expert-card__check">{isSelected ? "✓" : ""}</div>
      <div className="expert-card__header">
        {expert.avatar_url ? (
          <img src={expert.avatar_url} alt="" className="expert-card__avatar" />
        ) : (
          <div className="expert-card__avatar expert-card__avatar--placeholder">
            {expert.first_name[0]}
          </div>
        )}
        <div className="expert-card__info">
          <Typography variant="h4">
            {expert.first_name} {expert.last_name}
          </Typography>
          {expert.bio && (
            <Typography variant="small" className="expert-card__bio">
              {expert.bio}
            </Typography>
          )}
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
        {expert.other_skills.slice(0, 2).map((skill) => (
          <Tag key={skill} variant="outline" size="sm">
            {skill}
          </Tag>
        ))}
      </div>
    </div>
  );
}

// ============ Детальная страница проекта с чатом ============

interface ProjectDetailViewProps {
  projectId: string;
  onBack: () => void;
}

function ProjectDetailView({ projectId, onBack }: ProjectDetailViewProps) {
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "members">("chat");

  const wsRef = useRef<ChatWebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProject();
    loadMessages();
    connectWebSocket();

    return () => {
      wsRef.current?.disconnect();
    };
  }, [projectId]);

  const loadProject = async () => {
    try {
      const projectData = await projectApi.get(projectId);
      setProject(projectData);
      setMembers(projectData.members || []);
    } catch (e) {
      console.error("Failed to load project:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const response = await chatApi.getMessages(projectId, 100);
      setMessages(response.messages.reverse());
    } catch (e) {
      console.error("Failed to load messages:", e);
    }
  };

  const connectWebSocket = () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    wsRef.current = new ChatWebSocket(projectId, token, {
      onMessage: (msg) => {
        setMessages((prev) => [...prev, msg]);
        scrollToBottom();
      },
      onUserJoined: () => {},
      onUserLeft: () => {},
      onError: (error) => console.error("WebSocket error:", error),
    });

    wsRef.current.connect();
  };

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || isSending) return;

    try {
      setIsSending(true);
      if (wsRef.current?.isConnected()) {
        wsRef.current.sendMessage(messageText.trim());
      } else {
        await chatApi.sendMessage(projectId, { content: messageText.trim() });
        loadMessages();
      }
      setMessageText("");
    } catch (e) {
      console.error("Failed to send message:", e);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="project-detail project-detail--loading">
        <Loader />
      </div>
    );
  }

  return (
    <div className="project-detail">
      <header className="subpage-header">
        <button className="back-btn" onClick={onBack}>
          ← Назад
        </button>
        <Typography variant="h1">{project?.name || "Проект"}</Typography>
      </header>

      <div className="project-detail__tabs">
        <button
          className={`tab-btn ${activeTab === "chat" ? "tab-btn--active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          💬 Чат
        </button>
        <button
          className={`tab-btn ${
            activeTab === "members" ? "tab-btn--active" : ""
          }`}
          onClick={() => setActiveTab("members")}
        >
          👥 Участники ({members.length})
        </button>
      </div>

      {activeTab === "chat" && (
        <div className="project-detail__chat">
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-messages__empty">
                <Typography variant="body">Сообщений пока нет</Typography>
                <Typography variant="small">
                  Начните общение с командой!
                </Typography>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-message ${
                    msg.author_id === user?.id ? "chat-message--own" : ""
                  }`}
                >
                  <div className="chat-message__header">
                    <span className="chat-message__author">
                      {msg.author?.first_name || "Аноним"}
                    </span>
                    <span className="chat-message__time">
                      {new Date(msg.created_at).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="chat-message__content">{msg.content}</div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input" onSubmit={handleSendMessage}>
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Написать сообщение..."
              className="chat-input__field"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={isSending || !messageText.trim()}
            >
              ➤
            </Button>
          </form>
        </div>
      )}

      {activeTab === "members" && (
        <div className="project-detail__members">
          {members.map((member) => (
            <div key={member.user_id} className="member-card">
              {member.user_avatar_url ? (
                <img
                  src={member.user_avatar_url}
                  alt=""
                  className="member-card__avatar"
                />
              ) : (
                <div className="member-card__avatar member-card__avatar--placeholder">
                  {member.user_name?.[0] || "?"}
                </div>
              )}
              <div className="member-card__info">
                <Typography variant="h4">
                  {member.user_name || "Участник"}
                </Typography>
                <Typography variant="small">
                  {member.position || member.role}
                </Typography>
              </div>
              {member.role === "owner" && (
                <Tag variant="default" size="sm">
                  Владелец
                </Tag>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Секция Рейтинга (Leaderboard) ============

type LeaderboardTab = "users" | "ideas";
type LeaderboardPeriod = "all" | "weekly" | "monthly";

function LeaderboardSection() {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("users");
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [myStats, setMyStats] = useState<UserGamification | null>(null);
  const [usersLeaderboard, setUsersLeaderboard] = useState<LeaderboardEntry[]>(
    []
  );
  const [ideasLeaderboard, setIdeasLeaderboard] = useState<LeaderboardIdea[]>(
    []
  );
  const [myRank, setMyRank] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      const [statsRes, usersRes, ideasRes] = await Promise.all([
        ideaApi.getMyGamification(),
        ideaApi.getUsersLeaderboard(period, undefined, undefined, 20),
        ideaApi.getLeaderboard(period, undefined, undefined, 10),
      ]);

      setMyStats(statsRes);
      setUsersLeaderboard(usersRes.entries);
      setMyRank(usersRes.my_rank);
      setIdeasLeaderboard(ideasRes.ideas);
    } catch (e) {
      console.error("Failed to load leaderboard:", e);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <div className="leaderboard-section leaderboard-section--loading">
        <Loader />
      </div>
    );
  }

  return (
    <div className="leaderboard-section">
      {/* Моя статистика */}
      {myStats && (
        <div className="my-stats-card">
          <div className="my-stats-card__header">
            <Typography variant="h3">Мой прогресс</Typography>
            {myRank && <div className="my-stats-card__rank">#{myRank}</div>}
          </div>

          <div className="my-stats-card__points">
            <div className="points-block">
              <span className="points-block__value">
                {myStats.total_points}
              </span>
              <span className="points-block__label">Всего очков</span>
            </div>
            <div className="points-block">
              <span className="points-block__value">
                {myStats.weekly_points}
              </span>
              <span className="points-block__label">За неделю</span>
            </div>
            <div className="points-block">
              <span className="points-block__value">Ур. {myStats.level}</span>
              <span className="points-block__label">Уровень</span>
            </div>
          </div>

          <div className="my-stats-card__streak">
            {myStats.current_voting_streak > 0 && (
              <span className="streak-badge">
                🔥 {myStats.current_voting_streak} дней подряд
              </span>
            )}
          </div>

          {myStats.badges.length > 0 && (
            <div className="my-stats-card__badges">
              {myStats.badges.slice(0, 6).map((badge) => (
                <span
                  key={badge}
                  className="badge-item"
                  title={getBadgeLabel(badge)}
                >
                  {getBadgeLabel(badge).split(" ")[0]}
                </span>
              ))}
              {myStats.badges.length > 6 && (
                <span className="badge-item badge-item--more">
                  +{myStats.badges.length - 6}
                </span>
              )}
            </div>
          )}

          <div className="my-stats-card__activity">
            <div className="activity-stat">
              <span className="activity-stat__icon">💡</span>
              <span className="activity-stat__value">
                {myStats.ideas_count}
              </span>
              <span className="activity-stat__label">идей</span>
            </div>
            <div className="activity-stat">
              <span className="activity-stat__icon">👍</span>
              <span className="activity-stat__value">
                {myStats.swipes_count}
              </span>
              <span className="activity-stat__label">свайпов</span>
            </div>
            <div className="activity-stat">
              <span className="activity-stat__icon">📁</span>
              <span className="activity-stat__value">
                {myStats.projects_count}
              </span>
              <span className="activity-stat__label">проектов</span>
            </div>
          </div>
        </div>
      )}

      {/* Переключатели */}
      <div className="leaderboard-controls">
        <div className="leaderboard-tabs">
          <button
            className={`leaderboard-tab ${
              activeTab === "users" ? "leaderboard-tab--active" : ""
            }`}
            onClick={() => setActiveTab("users")}
          >
            👥 Участники
          </button>
          <button
            className={`leaderboard-tab ${
              activeTab === "ideas" ? "leaderboard-tab--active" : ""
            }`}
            onClick={() => setActiveTab("ideas")}
          >
            💡 Идеи
          </button>
        </div>

        <div className="leaderboard-period">
          <button
            className={`period-btn ${
              period === "weekly" ? "period-btn--active" : ""
            }`}
            onClick={() => setPeriod("weekly")}
          >
            Неделя
          </button>
          <button
            className={`period-btn ${
              period === "monthly" ? "period-btn--active" : ""
            }`}
            onClick={() => setPeriod("monthly")}
          >
            Месяц
          </button>
          <button
            className={`period-btn ${
              period === "all" ? "period-btn--active" : ""
            }`}
            onClick={() => setPeriod("all")}
          >
            Всё время
          </button>
        </div>
      </div>

      {/* Таблица лидеров */}
      <div className="leaderboard-list">
        {activeTab === "users" &&
          usersLeaderboard.map((entry) => (
            <div
              key={entry.user_id}
              className={`leaderboard-entry ${
                entry.rank <= 3 ? `leaderboard-entry--top${entry.rank}` : ""
              }`}
            >
              <div className="leaderboard-entry__rank">
                {entry.rank <= 3 ? (
                  <span className="rank-medal">
                    {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}
                  </span>
                ) : (
                  <span className="rank-number">#{entry.rank}</span>
                )}
              </div>

              <div className="leaderboard-entry__avatar">
                {entry.avatar_url ? (
                  <img src={entry.avatar_url} alt="" />
                ) : (
                  <div className="avatar-placeholder">
                    {entry.display_name?.[0] || "?"}
                  </div>
                )}
              </div>

              <div className="leaderboard-entry__info">
                <Typography variant="h4">{entry.display_name}</Typography>
                <Typography variant="small">
                  Ур. {entry.level} • {entry.badges_count} бейджей
                </Typography>
              </div>

              <div className="leaderboard-entry__points">{entry.points} ✨</div>
            </div>
          ))}

        {activeTab === "ideas" &&
          ideasLeaderboard.map((idea) => (
            <div
              key={idea.id}
              className={`leaderboard-entry ${
                idea.rank <= 3 ? `leaderboard-entry--top${idea.rank}` : ""
              }`}
            >
              <div className="leaderboard-entry__rank">
                {idea.rank <= 3 ? (
                  <span className="rank-medal">
                    {idea.rank === 1 ? "🥇" : idea.rank === 2 ? "🥈" : "🥉"}
                  </span>
                ) : (
                  <span className="rank-number">#{idea.rank}</span>
                )}
              </div>

              <div className="leaderboard-entry__info leaderboard-entry__info--idea">
                <Typography variant="h4">{idea.title}</Typography>
                <Typography variant="small">
                  {idea.author.first_name} {idea.author.last_name}
                </Typography>
              </div>

              <div className="leaderboard-entry__stats">
                <span>❤️ {idea.likes_count}</span>
                <span>⭐ {idea.super_likes_count}</span>
              </div>

              <div className="leaderboard-entry__score">
                {idea.idea_score.toFixed(1)}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
