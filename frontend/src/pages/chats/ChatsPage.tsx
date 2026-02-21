import { useState, useEffect, useCallback, useRef } from "react";
import {
  directChatApi,
  DMWebSocket,
  formatConversationTime,
  formatMessageTime,
  getParticipantName,
  getParticipantInitials,
} from "@/entities/direct-chat";
import type { Conversation, DirectMessage } from "@/entities/direct-chat";
import { useAuth } from "@/features/auth";
import {
  Avatar,
  Loader,
  Typography,
  Tabs,
  EmptyState,
  IconButton,
} from "@/shared";
import type { Tab } from "@/shared";
import { MessageActions } from "./components/MessageActions";
import { useMessageActions } from "./hooks/useMessageActions";
import "./ChatsPage.scss";

interface ChatsPageProps {
  /** Открыть конкретный диалог по ID пользователя */
  openUserId?: string;
  /** Данные пользователя для нового диалога */
  openUserData?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string | null;
  };
  /** Колбек после того, как чат открыт (сбросить target) */
  onChatOpened?: () => void;
  /** Открыть профиль пользователя (по клику на аватарку в чате) */
  onViewProfile?: (
    userId: string,
    userData: {
      first_name: string;
      last_name: string;
      avatar_url?: string | null;
    },
  ) => void;
  /** Уведомить о том, что чат открыт/закрыт (для скрытия футера) */
  onChatViewChange?: (isOpen: boolean) => void;
  /** Перейти на страницу контактов (кнопка «Написать») */
  onNavigateToContacts?: () => void;
}

export function ChatsPage({
  openUserId,
  openUserData,
  onChatOpened,
  onViewProfile,
  onChatViewChange,
  onNavigateToContacts,
}: ChatsPageProps) {
  const { user } = useAuth();
  const currentUserId = user?.id;

  // Состояния
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [locallyHiddenMessageIds, setLocallyHiddenMessageIds] = useState<Set<string>>(
    () => new Set(),
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wsRef = useRef<DMWebSocket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const activeConversationIdRef = useRef<string | null>(null);
  const markReadInFlightRef = useRef<Set<string>>(new Set());

  const messageActions = useMessageActions({
    activeConversationId: activeConversation?.id || null,
    wsRef,
    inputRef,
    setInputValue,
    setMessages,
    setLocallyHiddenMessageIds,
  });
  const isMessagingRestricted =
    !!activeConversation && !activeConversation.can_send_messages;

  useEffect(() => {
    activeConversationIdRef.current = activeConversation?.id || null;
  }, [activeConversation?.id]);

  const syncReadState = useCallback(async (conversationId: string) => {
    if (markReadInFlightRef.current.has(conversationId)) return;
    markReadInFlightRef.current.add(conversationId);
    try {
      await directChatApi.markAsRead(conversationId);
      wsRef.current?.markRead(conversationId);
      setMessages((prev) =>
        prev.map((m) =>
          m.conversation_id === conversationId ? { ...m, is_read: true } : m,
        ),
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c,
        ),
      );
    } catch {
      /* ignore */
    } finally {
      markReadInFlightRef.current.delete(conversationId);
    }
  }, []);

  // Загрузить диалоги
  const loadConversations = useCallback(async () => {
    try {
      setIsLoadingConversations(true);
      const res = await directChatApi.getConversations();
      setConversations(res.conversations);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  // Загрузить сообщения
  const loadMessages = useCallback(
    async (conversationId: string, before?: string) => {
      try {
        setIsLoadingMessages(true);
        const res = await directChatApi.getMessages(conversationId, 50, before);
        if (before) {
          setMessages((prev) => [...res.messages, ...prev]);
        } else {
          setMessages(res.messages);
        }
        setHasMoreMessages(res.has_more);
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [],
  );

  // Подключить WebSocket
  useEffect(() => {
    const ws = new DMWebSocket({
      onMessage: (data) => {
        if (data.type === "new_message") {
          const msg = data.message as DirectMessage & { sender_name?: string };

          // Обновить сообщения, если открыт тот же диалог
          setMessages((prev) => {
            if (activeConversationIdRef.current === msg.conversation_id) {
              // Не добавлять дубли
              if (prev.some((m) => m.id === msg.id)) return prev;

              // Если это своё сообщение — заменить оптимистичное (temp-*)
              if (msg.sender_id === currentUserId) {
                const tempIdx = prev.findIndex(
                  (m) => m.id.startsWith("temp-") && m.content === msg.content,
                );
                if (tempIdx !== -1) {
                  const updated = [...prev];
                  updated[tempIdx] = msg as DirectMessage;
                  return updated;
                }
              }

              return [...prev, msg as DirectMessage];
            }
            return prev;
          });

          // Обновить превью в списке диалогов
          setConversations((prev) =>
            prev
              .map((c) =>
                c.id === msg.conversation_id
                  ? {
                      ...c,
                      last_message_content: msg.content,
                      last_message_sender_id: msg.sender_id,
                      last_message_at: msg.created_at,
                      last_message_is_edited: false,
                      unread_count:
                        msg.sender_id !== currentUserId &&
                        c.id !== activeConversationIdRef.current
                          ? c.unread_count + 1
                          : c.unread_count,
                    }
                  : c,
              )
              .sort(
                (a, b) =>
                  new Date(b.last_message_at || b.created_at).getTime() -
                  new Date(a.last_message_at || a.created_at).getTime(),
              ),
          );
        } else if (data.type === "typing") {
          const typingData = data as unknown as {
            conversation_id: string;
            user_name: string;
            is_typing: boolean;
          };

          setActiveConversation((ac) => {
            if (ac?.id === typingData.conversation_id) {
              setTypingUser(typingData.is_typing ? typingData.user_name : null);
            }
            return ac;
          });
        } else if (data.type === "message_edited") {
          const editData = data as unknown as {
            message_id: string;
            conversation_id: string;
            content: string;
            edited_at: string;
          };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === editData.message_id
                ? {
                    ...m,
                    content: editData.content,
                    is_edited: true,
                    edited_at: editData.edited_at,
                  }
                : m,
            ),
          );
          setConversations((prev) =>
            prev.map((c) =>
              c.id === editData.conversation_id
                ? {
                    ...c,
                    last_message_content: editData.content,
                    last_message_is_edited: true,
                  }
                : c,
            ),
          );
        } else if (data.type === "message_deleted") {
          const delData = data as unknown as { message_id: string };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === delData.message_id
                ? { ...m, is_deleted: true, content: "" }
                : m,
            ),
          );
        } else if (data.type === "message_hidden_for_user") {
          const hiddenData = data as unknown as { message_id: string };
          setLocallyHiddenMessageIds((prev) => {
            const next = new Set(prev);
            next.add(hiddenData.message_id);
            return next;
          });
        } else if (data.type === "read_receipt") {
          const readData = data as unknown as { conversation_id: string };
          setMessages((prev) =>
            prev.map((m) =>
              m.conversation_id === readData.conversation_id
                ? { ...m, is_read: true }
                : m,
            ),
          );
        } else if (data.type === "error") {
          const errorData = data as unknown as { code?: string };
          if (errorData.code === "dm_privacy_restricted") {
            const conversationId = activeConversationIdRef.current;
            if (!conversationId) return;
            setActiveConversation((prev) =>
              prev ? { ...prev, can_send_messages: false } : prev,
            );
            setConversations((prev) =>
              prev.map((c) =>
                c.id === conversationId
                  ? { ...c, can_send_messages: false }
                  : c,
              ),
            );
            setInputValue("");
            setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-")));
          }
        }
      },
      onConnected: () => console.log("DM WebSocket connected"),
      onDisconnected: () => console.log("DM WebSocket disconnected"),
    });

    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!activeConversation || !currentUserId) return;
    const hasUnreadIncoming = messages.some(
      (m) =>
        m.conversation_id === activeConversation.id &&
        m.sender_id !== currentUserId &&
        !m.is_read &&
        !m.is_deleted &&
        !locallyHiddenMessageIds.has(m.id),
    );
    if (hasUnreadIncoming) {
      void syncReadState(activeConversation.id);
    }
  }, [
    activeConversation,
    currentUserId,
    locallyHiddenMessageIds,
    messages,
    syncReadState,
  ]);

  // Загрузить диалоги при монтировании
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Сбросить состояние чата при размонтировании
  useEffect(() => {
    return () => {
      onChatViewChange?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Открыть конкретный диалог по userId извне
  useEffect(() => {
    if (!openUserId || !openUserData) return;

    const openOrCreate = async () => {
      // Ищем существующий диалог
      const existing = conversations.find(
        (c) => c.participant.id === openUserId,
      );
      if (existing) {
        handleOpenConversation(existing);
        onChatOpened?.();
        return;
      }

      // Если диалоги загружены и не нашли — создаём новый
      if (!isLoadingConversations) {
        try {
          const res = await directChatApi.startConversation({
            recipient_id: openUserId,
            content: "",
          });
          setConversations((prev) => [res.conversation, ...prev]);
          setActiveConversation(res.conversation);
          onChatViewChange?.(true);
          setMessages(res.message.content ? [res.message] : []);
        } catch {
          // Может уже существовать — перезагрузим
          await loadConversations();
        }
        onChatOpened?.();
      }
    };

    openOrCreate();
  }, [openUserId, openUserData, conversations, isLoadingConversations]);

  // Прокрутить вниз при новых сообщениях
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Открыть диалог
  const handleOpenConversation = useCallback(
    async (conv: Conversation) => {
      setActiveConversation(conv);
      onChatViewChange?.(true);
      setMessages([]);
      setTypingUser(null);
      setLocallyHiddenMessageIds(new Set());
      await loadMessages(conv.id);

      // Пометить как прочитанные
      if (conv.unread_count > 0) {
        await syncReadState(conv.id);
      }

      if (conv.can_send_messages) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [loadMessages, syncReadState],
  );

  // Назад к списку
  const handleBack = () => {
    setActiveConversation(null);
    onChatViewChange?.(false);
    setMessages([]);
    setTypingUser(null);
    messageActions.resetMessageActions();
    setLocallyHiddenMessageIds(new Set());
    loadConversations();
  };

  // Отправить сообщение
  const handleSend = async () => {
    const content = inputValue.trim();
    if (!content || !activeConversation || !activeConversation.can_send_messages)
      return;

    if (messageActions.editingMessageId) {
      const targetId = messageActions.editingMessageId;
      setInputValue("");
      messageActions.handleCancelEdit();
      wsRef.current?.editMessage(activeConversation.id, targetId, content);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === targetId
            ? {
                ...m,
                content,
                is_edited: true,
                edited_at: new Date().toISOString(),
              }
            : m,
        ),
      );
      return;
    }

    setInputValue("");

    // Оптимистичное добавление
    const optimisticMsg: DirectMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: activeConversation.id,
      sender_id: currentUserId || "",
      content,
      is_read: false,
      is_edited: false,
      is_deleted: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    // Отправить через WS
    wsRef.current?.sendMessage(activeConversation.id, content);

    // Остановить typing
    if (isTypingRef.current) {
      isTypingRef.current = false;
      wsRef.current?.sendTyping(activeConversation.id, false);
    }
  };

  // Typing indicator
  const handleInputChange = (value: string) => {
    if (activeConversation && !activeConversation.can_send_messages) return;
    setInputValue(value);

    if (!activeConversation) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      wsRef.current?.sendTyping(activeConversation.id, true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      if (activeConversation) {
        wsRef.current?.sendTyping(activeConversation.id, false);
      }
    }, 2000);
  };

  // Нажатие Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Подгрузить старые сообщения
  const handleLoadMore = () => {
    if (activeConversation && messages.length > 0 && hasMoreMessages) {
      loadMessages(activeConversation.id, messages[0].created_at);
    }
  };

  // Общее число непрочитанных сообщений
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  // Табы
  const chatTabs: Tab[] = [
    {
      id: "all",
      label: (
        <>
          Все чаты
          {totalUnread > 0 && (
            <span className="chats-page__tab-badge">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </>
      ),
    },
    { id: "projects", label: "Проекты" },
    { id: "companies", label: "Компании" },
  ];

  // Фильтрация по табу (пока все показываем в "Все чаты")
  const filteredConversations = conversations;
  const visibleMessages = messages.filter(
    (msg) => !msg.is_deleted && !locallyHiddenMessageIds.has(msg.id),
  );

  // Группировка сообщений по дате
  const shouldShowDateSeparator = (msg: DirectMessage, idx: number) => {
    if (idx === 0) return true;
    const prev = visibleMessages[idx - 1];
    const prevDate = new Date(prev.created_at).toDateString();
    const currDate = new Date(msg.created_at).toDateString();
    return prevDate !== currDate;
  };

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );

    if (msgDate.getTime() === today.getTime()) return "Сегодня";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (msgDate.getTime() === yesterday.getTime()) return "Вчера";
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  // Позиция сообщения в группе (Telegram-стиль)
  const getMessagePosition = (
    msg: DirectMessage,
    idx: number,
  ): "single" | "first" | "middle" | "last" => {
    const prevMsg = idx > 0 ? visibleMessages[idx - 1] : null;
    const nextMsg =
      idx < visibleMessages.length - 1 ? visibleMessages[idx + 1] : null;

    const sameAsPrev =
      prevMsg &&
      !prevMsg.is_deleted &&
      prevMsg.sender_id === msg.sender_id &&
      !shouldShowDateSeparator(msg, idx);

    const sameAsNext =
      nextMsg &&
      !nextMsg.is_deleted &&
      nextMsg.sender_id === msg.sender_id &&
      idx + 1 < visibleMessages.length &&
      !shouldShowDateSeparator(nextMsg, idx + 1);

    if (sameAsPrev && sameAsNext) return "middle";
    if (sameAsPrev) return "last";
    if (sameAsNext) return "first";
    return "single";
  };

  // ═══════════ РЕНДЕР: Список диалогов ═══════════
  if (!activeConversation) {
    return (
      <div className="chats-page">
        {/* Заголовок */}
        <header className="chats-page__header">
          <IconButton aria-label="Назад">
            <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
              <path
                d="M9 1L1 9L9 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
          <div className="chats-page__title-container">
            <h1 className="chats-page__title">Чаты</h1>
          </div>
          <IconButton onClick={onNavigateToContacts} aria-label="Написать">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </IconButton>
        </header>

        {/* Табы */}
        <div className="chats-page__tabs">
          <Tabs
            tabs={chatTabs}
            activeId={activeTab}
            onChange={setActiveTab}
            size="md"
          />
        </div>

        {/* Список */}
        {isLoadingConversations ? (
          <div className="chats-page chats-page--loading">
            <Loader />
            <Typography variant="body" color="muted">
              Загрузка чатов...
            </Typography>
          </div>
        ) : filteredConversations.length === 0 ? (
          <EmptyState emoji="💬" title="Нет сообщений" />
        ) : (
          <div className="chats-page__list">
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                className="chats-page__card"
                onClick={() => handleOpenConversation(conv)}
                type="button"
              >
                <div className="chats-page__card-avatar">
                  <Avatar
                    src={conv.participant.avatar_url || undefined}
                    initials={getParticipantInitials(conv.participant)}
                    size="md"
                  />
                </div>

                <div className="chats-page__card-content">
                  <div className="chats-page__card-top">
                    <span className="chats-page__card-name">
                      {getParticipantName(conv.participant)}
                    </span>
                    <span className="chats-page__card-time">
                      {formatConversationTime(conv.last_message_at)}
                    </span>
                  </div>
                  <div className="chats-page__card-bottom">
                    <span className="chats-page__card-preview">
                      {conv.last_message_sender_id === currentUserId && (
                        <span className="chats-page__card-you">Вы: </span>
                      )}
                      {conv.last_message_is_edited && (
                        <span className="chats-page__card-edited">
                          {"\u0440\u0435\u0434. "}
                        </span>
                      )}
                      {conv.last_message_content || "Начните общение"}
                    </span>
                    {conv.unread_count > 0 && (
                      <span className="chats-page__card-badge">
                        {conv.unread_count > 99 ? "99+" : conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="chats-page chats-page--chat-open">
      {/* Шапка чата */}
      <header className="chats-page__chat-header">
        <IconButton onClick={handleBack} aria-label="Назад">
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
            <path
              d="M9 1L1 9L9 17"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>

        <div className="chats-page__chat-user-info">
          <span className="chats-page__chat-user-name">
            {getParticipantName(activeConversation.participant)}
          </span>
          {typingUser && (
            <span className="chats-page__typing">печатает...</span>
          )}
        </div>

        <div
          className="chats-page__chat-avatar"
          onClick={() => {
            if (onViewProfile && activeConversation) {
              onViewProfile(activeConversation.participant.id, {
                first_name: activeConversation.participant.first_name,
                last_name: activeConversation.participant.last_name,
                avatar_url: activeConversation.participant.avatar_url,
              });
            }
          }}
          style={{ cursor: onViewProfile ? "pointer" : undefined }}
        >
          <Avatar
            src={activeConversation.participant.avatar_url || undefined}
            initials={getParticipantInitials(activeConversation.participant)}
            size="sm"
          />
        </div>
      </header>

      {/* Сообщения */}
      <div className="chats-page__messages" ref={messagesContainerRef}>
        {hasMoreMessages && (
          <button
            className="chats-page__load-more"
            onClick={handleLoadMore}
            disabled={isLoadingMessages}
            type="button"
          >
            {isLoadingMessages ? "Загрузка..." : "Показать ранние"}
          </button>
        )}

        {isLoadingMessages && messages.length === 0 && (
          <div className="chats-page chats-page--loading">
            <Loader />
          </div>
        )}

        {visibleMessages.length === 0 && !isLoadingMessages && (
          <div className="chats-page__messages-empty">
            <Typography variant="body" color="muted">
              Напишите первое сообщение
            </Typography>
          </div>
        )}

        {visibleMessages.map((msg, idx) => {
          const isOwn = msg.sender_id === currentUserId;
          const showDate = shouldShowDateSeparator(msg, idx);
          const position = getMessagePosition(msg, idx);

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="chats-page__date-separator">
                  <span>{getDateLabel(msg.created_at)}</span>
                </div>
              )}
              <div
                className={`chats-page__message chats-page__message--${isOwn ? "own" : "other"} chats-page__message--${position}`}
              >
                <div
                  className="chats-page__bubble"
                  onContextMenu={(e) => messageActions.openActionMenu(e, msg)}
                  onTouchStart={(e) =>
                    messageActions.handleMessageTouchStart(e, msg)
                  }
                  onTouchEnd={messageActions.handleMessageTouchEnd}
                  onTouchCancel={messageActions.handleMessageTouchEnd}
                  onTouchMove={messageActions.handleMessageTouchMove}
                >
                  {msg.forwarded_from_name && (
                    <p className="chats-page__bubble-forwarded">
                      Переслано от {msg.forwarded_from_name}
                    </p>
                  )}
                  <p className="chats-page__bubble-text">{msg.content}</p>
                  <div className="chats-page__bubble-meta">
                    {msg.is_edited && (
                      <span className="chats-page__bubble-edited">ред.</span>
                    )}
                    <span className="chats-page__bubble-time">
                      {formatMessageTime(msg.created_at)}
                    </span>
                    {isOwn && (
                      <span
                        className={`chats-page__bubble-status ${msg.is_read ? "chats-page__bubble-status--read" : ""}`}
                      >
                        {msg.is_read ? (
                          <svg
                            width="13"
                            height="8"
                            viewBox="0 0 13 8"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M9.6012 0.000208761C9.47645 0.0039259 9.35805 0.0560636 9.27108 0.145576L3.36823 6.04843L0.826641 3.50685C0.782395 3.46076 0.729398 3.42397 0.670754 3.39862C0.61211 3.37328 0.548998 3.35989 0.485115 3.35924C0.421231 3.35859 0.35786 3.37069 0.298713 3.39484C0.239565 3.41898 0.185831 3.45469 0.140656 3.49987C0.0954811 3.54504 0.0597742 3.59878 0.0356263 3.65792C0.0114784 3.71707 -0.000625049 3.78044 2.48505e-05 3.84433C0.00067475 3.90821 0.0140649 3.97132 0.0394111 4.02996C0.0647573 4.08861 0.10155 4.14161 0.147635 4.18585L3.02872 7.06694C3.11878 7.15696 3.2409 7.20753 3.36823 7.20753C3.49556 7.20753 3.61767 7.15696 3.70773 7.06694L9.95009 0.824582C10.0195 0.757135 10.0669 0.670299 10.0861 0.575453C10.1052 0.480608 10.0953 0.382179 10.0576 0.293064C10.0199 0.203949 9.95615 0.128306 9.8747 0.0760488C9.79326 0.0237912 9.69793 -0.00264367 9.6012 0.000208761Z"
                              fill="currentColor"
                            />
                            <path
                              d="M5.53217 6.82297L11.8024 0.552734"
                              stroke="currentColor"
                              strokeWidth="0.960363"
                              strokeLinecap="round"
                            />
                          </svg>
                        ) : (
                          <svg
                            width="11"
                            height="8"
                            viewBox="0 0 11 8"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M9.6012 0.000208761C9.47645 0.0039259 9.35805 0.0560636 9.27108 0.145576L3.36823 6.04843L0.826641 3.50685C0.782395 3.46076 0.729398 3.42397 0.670754 3.39862C0.61211 3.37328 0.548998 3.35989 0.485115 3.35924C0.421231 3.35859 0.35786 3.37069 0.298713 3.39484C0.239565 3.41898 0.185831 3.45469 0.140656 3.49987C0.0954811 3.54504 0.0597742 3.59878 0.0356263 3.65792C0.0114784 3.71707 -0.000625049 3.78044 2.48505e-05 3.84433C0.00067475 3.90821 0.0140649 3.97132 0.0394111 4.02996C0.0647573 4.08861 0.10155 4.14161 0.147635 4.18585L3.02872 7.06694C3.11878 7.15696 3.2409 7.20753 3.36823 7.20753C3.49556 7.20753 3.61767 7.15696 3.70773 7.06694L9.95009 0.824582C10.0195 0.757135 10.0669 0.670299 10.0861 0.575453C10.1052 0.480608 10.0953 0.382179 10.0576 0.293064C10.0199 0.203949 9.95615 0.128306 9.8747 0.0760488C9.79326 0.0237912 9.69793 -0.00264367 9.6012 0.000208761Z"
                              fill="currentColor"
                            />
                          </svg>
                        )}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="chats-page__message-actions"
                    onClick={(e) => messageActions.openActionMenu(e, msg)}
                    aria-label="Действия с сообщением"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="5" cy="12" r="2" fill="currentColor" />
                      <circle cx="12" cy="12" r="2" fill="currentColor" />
                      <circle cx="19" cy="12" r="2" fill="currentColor" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      <MessageActions
        controller={messageActions}
        visibleMessages={visibleMessages}
        conversations={conversations}
        currentUserId={currentUserId}
      />

      {/* Ввод сообщения */}
      <div className="chats-page__input-area">
        {isMessagingRestricted && (
          <div className="chats-page__restricted-note">
            {"\u041A\u043E\u043D\u0442\u0430\u043A\u0442 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0438\u043B \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u044C \u043F\u0438\u0441\u0430\u0442\u044C \u0435\u043C\u0443"}
          </div>
        )}
        {messageActions.editingMessageId && (
          <div className="chats-page__edit-bar">
            <div className="chats-page__edit-info">
              <span className="chats-page__edit-title">Редактирование</span>
              <span className="chats-page__edit-preview">
                {messages.find((m) => m.id === messageActions.editingMessageId)?.content || ""}
              </span>
            </div>
            <button
              type="button"
              className="chats-page__edit-cancel"
              onClick={messageActions.handleCancelEdit}
            >
              Отмена
            </button>
          </div>
        )}
        <div className="chats-page__input-row">
          <textarea
            ref={inputRef}
            className="chats-page__input"
            placeholder={
              isMessagingRestricted
                ? "\u041E\u0442\u043F\u0440\u0430\u0432\u043A\u0430 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430"
                : messageActions.editingMessageId
                  ? "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435..."
                  : "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435..."
            }
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isMessagingRestricted}
          />
          <button
            className={`chats-page__send-btn ${inputValue.trim() ? "chats-page__send-btn--active" : ""}`}
            onClick={handleSend}
            disabled={!inputValue.trim() || isMessagingRestricted}
            type="button"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
