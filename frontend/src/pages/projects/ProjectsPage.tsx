import { useState, useEffect, useCallback, useRef } from "react";
import {
  projectApi,
  type Project,
  type ProjectMember,
  type Invitation,
} from "@/entities/project";
import { chatApi, ChatWebSocket, type ChatMessage } from "@/entities/chat";
import { useAuth } from "@/features/auth";
import { Typography, Loader, Button, Tag } from "@/shared";
import { useI18n } from "@/shared/config";
import "./ProjectsPage.scss";

export function ProjectsPage() {
  const { t } = useI18n();
  const [projects, setProjects] = useState<Project[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<"projects" | "invitations">("projects");

  // Состояние для детальной страницы
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );

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

  // Детальная страница проекта
  if (selectedProjectId) {
    return (
      <ProjectDetailSubPage
        projectId={selectedProjectId}
        onBack={() => setSelectedProjectId(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="projects-page projects-page--loading">
        <Loader />
      </div>
    );
  }

  return (
    <div className="projects-page">
      <header className="projects-page__header">
        <Typography variant="h1">{t("projects.title")}</Typography>
      </header>

      <div className="projects-page__tabs">
        <Button
          variant={tab === "projects" ? "primary" : "ghost"}
          onClick={() => setTab("projects")}
        >
          {t("projects.myProjects")}{" "}
          {projects.length > 0 && `(${projects.length})`}
        </Button>
        <Button
          variant={tab === "invitations" ? "primary" : "ghost"}
          onClick={() => setTab("invitations")}
        >
          {t("projects.invitations")}{" "}
          {invitations.length > 0 && `(${invitations.length})`}
        </Button>
      </div>

      {tab === "projects" && (
        <div className="projects-page__list">
          {projects.length === 0 ? (
            <div className="projects-page__empty">
              <Typography variant="body">{t("projects.noProjects")}</Typography>
              <Typography variant="small">
                {t("projects.noProjectsDescription")}
              </Typography>
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                className="project-card"
                onClick={() => setSelectedProjectId(project.id)}
              >
                <div className="project-card__header">
                  <Typography variant="h3">{project.name}</Typography>
                  <Tag
                    variant={
                      project.status === "active" ? "default" : "outline"
                    }
                  >
                    {project.status === "active"
                      ? t("projects.active")
                      : project.status === "completed"
                        ? t("projects.completed")
                        : t("projects.archive")}
                  </Tag>
                </div>
                <Typography
                  variant="body"
                  className="project-card__description"
                >
                  {project.description}
                </Typography>
                <div className="project-card__meta">
                  <span>
                    👥{" "}
                    {t("projects.membersCount", {
                      n: String(project.members_count),
                    })}
                  </span>
                  {project.unread_messages_count > 0 && (
                    <span className="project-card__unread">
                      💬 {project.unread_messages_count}{" "}
                      {t("projects.newCount")}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "invitations" && (
        <div className="projects-page__invitations">
          {invitations.length === 0 ? (
            <div className="projects-page__empty">
              <Typography variant="body">
                {t("projects.noInvitations")}
              </Typography>
            </div>
          ) : (
            invitations.map((invitation) => (
              <div key={invitation.id} className="invitation-card">
                <div className="invitation-card__header">
                  <Typography variant="h3">
                    {invitation.project_name}
                  </Typography>
                  <Typography variant="small">
                    {t("projects.from", {
                      name: invitation.inviter_name || t("common.unknown"),
                    })}
                  </Typography>
                </div>
                {invitation.message && (
                  <Typography
                    variant="small"
                    className="invitation-card__message"
                  >
                    {invitation.message}
                  </Typography>
                )}
                <div className="invitation-card__actions">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleAcceptInvitation(invitation.id)}
                  >
                    {t("common.accept")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeclineInvitation(invitation.id)}
                  >
                    {t("common.decline")}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ====== Детальная страница проекта с чатом ======

interface ProjectDetailSubPageProps {
  projectId: string;
  onBack: () => void;
}

function ProjectDetailSubPage({
  projectId,
  onBack,
}: ProjectDetailSubPageProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const wsRef = useRef<ChatWebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "members">("chat");

  useEffect(() => {
    loadProject();
    loadMessages();
    connectWebSocket();

    return () => {
      wsRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      onUserJoined: () => {
        // Можно добавить уведомление
      },
      onUserLeft: () => {
        // Можно добавить уведомление
      },
      onError: (error) => {
        console.error("WebSocket error:", error);
      },
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

      // Отправляем через WebSocket если подключен, иначе через API
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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return t("common.today");
    } else if (date.toDateString() === yesterday.toDateString()) {
      return t("common.yesterday");
    }
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  };

  // Группировка сообщений по дням
  const groupedMessages = messages.reduce(
    (groups, message) => {
      const date = formatDate(message.created_at);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
      return groups;
    },
    {} as Record<string, ChatMessage[]>,
  );

  if (isLoading) {
    return (
      <div className="project-detail project-detail--loading">
        <Loader />
      </div>
    );
  }

  return (
    <div className="project-detail">
      <header className="project-detail__header">
        <Button variant="ghost" onClick={onBack}>
          {t("projects.back")}
        </Button>
        <div className="project-detail__title">
          <Typography variant="h2">{project?.name}</Typography>
          <Typography variant="small">
            {t("projects.membersCount", { n: String(members.length) })}
          </Typography>
        </div>
      </header>

      <div className="project-detail__tabs">
        <Button
          variant={activeTab === "chat" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("chat")}
        >
          {t("projects.chatTab")}
        </Button>
        <Button
          variant={activeTab === "members" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("members")}
        >
          {t("projects.membersTab", { n: String(members.length) })}
        </Button>
      </div>

      {activeTab === "chat" && (
        <div className="project-detail__chat">
          <div className="chat-messages">
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date} className="chat-messages__group">
                <div className="chat-messages__date">{date}</div>
                {msgs.map((message) => {
                  const isOwn = message.author_id === user?.id;
                  return (
                    <div
                      key={message.id}
                      className={`chat-message ${
                        isOwn ? "chat-message--own" : ""
                      }`}
                    >
                      {!isOwn && (
                        <div className="chat-message__author">
                          {message.author?.avatar_url ? (
                            <img
                              src={message.author.avatar_url}
                              alt=""
                              className="chat-message__avatar"
                            />
                          ) : (
                            <div className="chat-message__avatar chat-message__avatar--placeholder">
                              {message.author?.first_name?.[0] || "?"}
                            </div>
                          )}
                          <span className="chat-message__name">
                            {message.author?.first_name}{" "}
                            {message.author?.last_name}
                          </span>
                        </div>
                      )}
                      <div className="chat-message__bubble">
                        <div className="chat-message__content">
                          {message.content}
                        </div>
                        <div className="chat-message__time">
                          {formatTime(message.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input" onSubmit={handleSendMessage}>
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={t("projects.writeMessagePlaceholder")}
              className="chat-input__field"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={isSending || !messageText.trim()}
            >
              {t("common.send")}
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
                  {member.user_name || t("projects.unknownUser")}
                </Typography>
                <Tag variant="outline" size="sm">
                  {member.role === "owner"
                    ? t("projects.owner")
                    : member.role === "admin"
                      ? t("projects.admin")
                      : t("projects.memberRole")}
                </Tag>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
