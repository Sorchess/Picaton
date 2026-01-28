import { useState, useEffect, useMemo, useCallback } from "react";
import { projectApi, type Project } from "@/entities/project";
import { useAuth } from "@/features/auth";
import { CreateProjectModal } from "@/features/create-project-modal";
import {
  Tag,
  Loader,
  Typography,
  Avatar,
  IconButton,
  Tabs,
  type Tab,
} from "@/shared";
import "./CollaborationPage.scss";

type TabType = "showcase" | "my";

interface ProjectCardData {
  id: string;
  title: string;
  description: string;
  tags: string[];
  deadline?: number; // days remaining
  members: Array<{
    id: string;
    name: string;
    avatarUrl?: string | null;
  }>;
  daysAgo: number;
  type: "project";
  originalData: Project;
}

// Helper to calculate days ago
function getDaysAgo(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Helper to format days
function formatDaysAgo(days: number): string {
  if (days === 0) return "сегодня";
  if (days === 1) return "1 д";
  return `${days} д`;
}

// Helper to format deadline
function formatDeadline(days: number): string {
  if (days === 1) return "1 день";
  if (days <= 4) return `${days} дня`;
  return `${days} дней`;
}

export function CollaborationPage() {
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("showcase");
  const [showcaseProjects, setShowcaseProjects] = useState<Project[]>([]);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadShowcaseProjects = useCallback(async () => {
    try {
      // Load public projects for showcase
      const response = await projectApi.getPublicProjects(50);
      setShowcaseProjects(response.projects || []);
    } catch (err) {
      console.error("Failed to load showcase projects:", err);
      setShowcaseProjects([]);
    }
  }, []);

  const loadMyProjects = useCallback(async () => {
    if (!authUser?.id) return;
    try {
      const response = await projectApi.getMyProjects(true);
      setMyProjects(response.projects || []);
    } catch (err) {
      console.error("Failed to load my projects:", err);
      setMyProjects([]);
    }
  }, [authUser?.id]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          loadShowcaseProjects(),
          loadMyProjects(),
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [loadShowcaseProjects, loadMyProjects]);

  // Transform projects to card format
  const transformedShowcase: ProjectCardData[] = useMemo(() => {
    return showcaseProjects.map((project) => ({
      id: project.id,
      title: project.name,
      description: project.description || "",
      tags: project.tags || [],
      deadline: project.deadline ? Math.ceil((new Date(project.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : undefined,
      members: [],
      daysAgo: getDaysAgo(project.created_at),
      type: "project" as const,
      originalData: project,
    }));
  }, [showcaseProjects]);

  const transformedMyProjects: ProjectCardData[] = useMemo(() => {
    return myProjects.map((project) => ({
      id: project.id,
      title: project.name,
      description: project.description || "",
      tags: project.tags || [],
      deadline: project.deadline ? Math.ceil((new Date(project.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : undefined,
      members: [],
      daysAgo: getDaysAgo(project.created_at),
      type: "project" as const,
      originalData: project,
    }));
  }, [myProjects]);

  const currentData = useMemo(() => {
    switch (activeTab) {
      case "showcase":
        return transformedShowcase;
      case "my":
        return transformedMyProjects;
      default:
        return [];
    }
  }, [
    activeTab,
    transformedShowcase,
    transformedMyProjects,
  ]);

  const tabs: Tab[] = [
    { id: "showcase", label: "Витрина проектов" },
    { id: "my", label: "Мои проекты" },
  ];

  const handleCardClick = (card: ProjectCardData) => {
    // TODO: Implement navigation to idea/project detail
    // For now, just log the click
    console.log("Card clicked:", card.id, card.type);
  };

  const handleProjectCreated = (projectId: string) => {
    console.log("Project created:", projectId);
    // Reload my projects and switch to "my" tab
    loadMyProjects();
    loadShowcaseProjects();
    setActiveTab("my");
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="collaboration-page collaboration-page--loading">
        <Loader />
        <Typography variant="body" color="muted">
          Загрузка проектов...
        </Typography>
      </div>
    );
  }

  return (
    <div className="collaboration-page">
      {/* Header */}
      <header className="collaboration-page__header">
        <IconButton onClick={() => {}} aria-label="Фильтр">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M2.25 4.5H15.75M4.5 9H13.5M6.75 13.5H11.25"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
        <div className="collaboration-page__title-container">
          <h1 className="collaboration-page__title">Коллаборации</h1>
        </div>
        <IconButton
          onClick={() => setIsCreateModalOpen(true)}
          aria-label="Добавить проект"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M9.768 16.0391C9.768 16.332 9.66 16.5859 9.445 16.8008C9.23 17.0156 8.97 17.123 8.664 17.123C8.365 17.123 8.107 17.0156 7.893 16.8008C7.678 16.5859 7.57 16.332 7.57 16.0391V1.86914C7.57 1.56966 7.678 1.3125 7.893 1.09766C8.107 0.882812 8.365 0.775391 8.664 0.775391C8.97 0.775391 9.23 0.882812 9.445 1.09766C9.66 1.3125 9.768 1.56966 9.768 1.86914V16.0391ZM1.584 10.043C1.285 10.043 1.027 9.93883 0.812 9.73047C0.598 9.51562 0.49 9.25521 0.49 8.94922C0.49 8.64974 0.598 8.39258 0.812 8.17773C1.027 7.95638 1.285 7.8457 1.584 7.8457H15.744C16.044 7.8457 16.301 7.95638 16.516 8.17773C16.73 8.39258 16.838 8.64974 16.838 8.94922C16.838 9.25521 16.73 9.51562 16.516 9.73047C16.301 9.93883 16.044 10.043 15.744 10.043H1.584Z"
              fill="currentColor"
            />
          </svg>
        </IconButton>
      </header>

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as TabType)}
        className="collaboration-page__tabs"
      />

      {error && (
        <div
          className="collaboration-page__error"
          onClick={() => setError(null)}
        >
          {error}
        </div>
      )}

      {/* Project List */}
      <div className="collaboration-page__list">
        {currentData.length === 0 ? (
          <div className="collaboration-page__empty">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <h3>
              {activeTab === "showcase" && "Нет проектов"}
              {activeTab === "my" && "У вас пока нет проектов"}
            </h3>
            <p>
              {activeTab === "showcase" &&
                "Здесь появятся проекты, которые ищут участников"}
              {activeTab === "my" &&
                "Создайте свой первый проект или присоединитесь к существующему"}
            </p>
          </div>
        ) : (
          currentData.map((card) => (
            <div
              key={card.id}
              className="collaboration-page__project-card"
              onClick={() => handleCardClick(card)}
            >
              {/* Card Header with Tags and Stats */}
              <div className="collaboration-page__project-header">
                <div className="collaboration-page__project-tags">
                  {card.tags.map((tag) => (
                    <Tag key={tag} size="sm" variant="outline">
                      {tag}
                    </Tag>
                  ))}
                </div>
                <div className="collaboration-page__project-stats">
                  {card.deadline && card.deadline > 0 && (
                    <div className="collaboration-page__project-deadline">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>{formatDeadline(card.deadline)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Content */}
              <h3 className="collaboration-page__project-title">
                {card.title}
              </h3>
              <p className="collaboration-page__project-description">
                {card.description}
              </p>

              {/* Card Footer with Members and Date */}
              <div className="collaboration-page__project-footer">
                <div className="collaboration-page__project-members">
                  {card.members.slice(0, 8).map((member, index) => (
                    <div
                      key={member.id}
                      className="collaboration-page__project-member"
                      style={{ zIndex: card.members.length - index }}
                    >
                      {member.avatarUrl ? (
                        <Avatar
                          src={member.avatarUrl}
                          alt={member.name}
                          size="sm"
                        />
                      ) : (
                        <Avatar initials={getInitials(member.name)} size="sm" />
                      )}
                    </div>
                  ))}
                  {card.members.length > 8 && (
                    <div className="collaboration-page__project-member collaboration-page__project-member--more">
                      +{card.members.length - 8}
                    </div>
                  )}
                </div>
                <span className="collaboration-page__project-date">
                  {formatDaysAgo(card.daysAgo)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleProjectCreated}
      />
    </div>
  );
}
