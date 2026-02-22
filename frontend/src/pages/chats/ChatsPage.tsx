import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  Modal,
} from "@/shared";
import type { Tab } from "@/shared";
import { MessageActions } from "./components/MessageActions";
import { useMessageActions } from "./hooks/useMessageActions";
import "./ChatsPage.scss";

const CONTACT_CARD_PREFIX = "contact_card::";
const CONTACT_CARD_LEGACY_PREFIX = "contact_card:";

interface SharedContactCard {
  type: "contact_card";
  user_id?: string;
  full_name: string;
  role?: string;
  avatar_url?: string | null;
  contacts?: Array<{ type: string; value: string }>;
}

function parseSharedContactCard(content: string): SharedContactCard | null {
  if (!content) return null;

  let jsonPayload = "";
  if (content.startsWith(CONTACT_CARD_PREFIX)) {
    jsonPayload = content.slice(CONTACT_CARD_PREFIX.length).trim();
  } else if (content.startsWith(CONTACT_CARD_LEGACY_PREFIX)) {
    jsonPayload = content.slice(CONTACT_CARD_LEGACY_PREFIX.length).trim();
  } else {
    return null;
  }

  try {
    const raw = JSON.parse(jsonPayload) as SharedContactCard;
    if (!raw || raw.type !== "contact_card" || !raw.full_name) return null;
    return raw;
  } catch {
    return null;
  }
}

function getInitialsFromFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return (parts[0] || "").slice(0, 2).toUpperCase();
}

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
  const [replyToMessage, setReplyToMessage] = useState<DirectMessage | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState("all");
  const [locallyHiddenMessageIds, setLocallyHiddenMessageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<string | null>(
    null,
  );
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isMultiDeleteOpen, setIsMultiDeleteOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wsRef = useRef<DMWebSocket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const activeConversationIdRef = useRef<string | null>(null);
  const markReadInFlightRef = useRef<Set<string>>(new Set());
  const MAX_INPUT_HEIGHT = 120;

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
        return res.messages;
      } catch (err) {
        console.error("Failed to load messages:", err);
        return [] as DirectMessage[];
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
          setReplyToMessage(null);
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
      setReplyToMessage(null);
      setMessages([]);
      setTypingUser(null);
      setLocallyHiddenMessageIds(new Set());
      setFirstUnreadMessageId(null);
      setIsMultiSelectMode(false);
      setSelectedMessageIds(new Set());
      const loadedMessages = await loadMessages(conv.id);

      if (conv.unread_count > 0 && currentUserId) {
        const firstUnreadIncoming = loadedMessages.find(
          (m) => m.sender_id !== currentUserId && !m.is_deleted && !m.is_read,
        );
        setFirstUnreadMessageId(firstUnreadIncoming?.id || null);
      }

      // Пометить как прочитанные
      if (conv.unread_count > 0) {
        await syncReadState(conv.id);
      }

      if (conv.can_send_messages) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [currentUserId, loadMessages, syncReadState],
  );

  // Назад к списку
  const handleBack = () => {
    setActiveConversation(null);
    onChatViewChange?.(false);
    setMessages([]);
    setTypingUser(null);
    messageActions.resetMessageActions();
    setReplyToMessage(null);
    setLocallyHiddenMessageIds(new Set());
    setFirstUnreadMessageId(null);
    setIsMultiSelectMode(false);
    setSelectedMessageIds(new Set());
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
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.overflowY = "hidden";
    }
    const replyToId = replyToMessage?.id || null;
    setReplyToMessage(null);

    // Оптимистичное добавление
    const optimisticMsg: DirectMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: activeConversation.id,
      sender_id: currentUserId || "",
      content,
      is_read: false,
      is_edited: false,
      is_deleted: false,
      reply_to_id: replyToId,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    // Отправить через WS
    wsRef.current?.sendMessage(activeConversation.id, content, replyToId || undefined);

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

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, MAX_INPUT_HEIGHT);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > MAX_INPUT_HEIGHT ? "auto" : "hidden";
  }, [inputValue, MAX_INPUT_HEIGHT]);

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
  const selectedMessages = useMemo(
    () => visibleMessages.filter((m) => selectedMessageIds.has(m.id)),
    [selectedMessageIds, visibleMessages],
  );
  const canForwardSelected = useMemo(
    () => selectedMessages.some((m) => !m.id.startsWith("temp-")),
    [selectedMessages],
  );
  useEffect(() => {
    if (!isMultiSelectMode) return;
    const visibleIds = new Set(visibleMessages.map((m) => m.id));
    setSelectedMessageIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (visibleIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [isMultiSelectMode, visibleMessages]);

  useEffect(() => {
    if (isMultiSelectMode && selectedMessageIds.size === 0) {
      setIsMultiSelectMode(false);
    }
  }, [isMultiSelectMode, selectedMessageIds]);

  const messagesById = useMemo(
    () => new Map(messages.map((m) => [m.id, m])),
    [messages],
  );

  const getMessageAuthorLabel = useCallback(
    (msg: DirectMessage) => {
      if (msg.sender_id === currentUserId) return "Вы";
      if (msg.sender) {
        const fullName = `${msg.sender.first_name} ${msg.sender.last_name}`.trim();
        if (fullName) return fullName;
      }
      return activeConversation
        ? getParticipantName(activeConversation.participant)
        : "Собеседник";
    },
    [activeConversation, currentUserId],
  );

  const handleReplyMessage = useCallback(
    (msg: DirectMessage) => {
      messageActions.closeActionMenu();
      setReplyToMessage(msg);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [messageActions],
  );

  const startMultiSelectMode = useCallback(
    (msg: DirectMessage) => {
      messageActions.closeActionMenu();
      setIsMultiSelectMode(true);
      setSelectedMessageIds(new Set([msg.id]));
    },
    [messageActions],
  );

  const exitMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode(false);
    setSelectedMessageIds(new Set());
    setIsMultiDeleteOpen(false);
  }, []);

  const toggleMessageSelection = useCallback((messageId: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  const handleForwardSelected = useCallback(() => {
    messageActions.handleForwardMessages(selectedMessages);
  }, [messageActions, selectedMessages]);

  const handleDeleteSelectedForMe = useCallback(async () => {
    if (!activeConversation?.id || selectedMessageIds.size === 0) return;
    const ids = Array.from(selectedMessageIds);
    try {
      await Promise.allSettled(
        ids.map((id) => directChatApi.deleteMessage(activeConversation.id, id, true)),
      );
      setLocallyHiddenMessageIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
      setSelectedMessageIds(new Set());
      setIsMultiSelectMode(false);
      setIsMultiDeleteOpen(false);
    } catch {
      /* ignore */
    }
  }, [activeConversation?.id, selectedMessageIds]);

  const handleDeleteSelectedForEveryone = useCallback(() => {
    if (!activeConversation?.id || selectedMessages.length === 0) return;
    selectedMessages.forEach((msg) => {
      wsRef.current?.deleteMessage(activeConversation.id, msg.id, false);
    });
    setMessages((prev) =>
      prev.map((m) =>
        selectedMessageIds.has(m.id) ? { ...m, is_deleted: true, content: "" } : m,
      ),
    );
    setSelectedMessageIds(new Set());
    setIsMultiSelectMode(false);
    setIsMultiDeleteOpen(false);
  }, [activeConversation?.id, selectedMessageIds, selectedMessages]);

  const handleForwardComplete = useCallback(
    (targetConversationId: string) => {
      setSelectedMessageIds(new Set());
      setIsMultiSelectMode(false);
      if (activeConversation?.id === targetConversationId) return;
      const targetConversation = conversations.find(
        (c) => c.id === targetConversationId,
      );
      if (targetConversation) {
        void handleOpenConversation(targetConversation);
      }
    },
    [activeConversation?.id, conversations, handleOpenConversation],
  );

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

  const getMessagePreviewText = useCallback((content: string): string => {
    const sharedContact = parseSharedContactCard(content);
    if (sharedContact) {
      return `📇 Контакт: ${sharedContact.full_name}`;
    }
    if (
      content.startsWith(CONTACT_CARD_PREFIX) ||
      content.startsWith(CONTACT_CARD_LEGACY_PREFIX)
    ) {
      return "📇 Контакт";
    }
    return content;
  }, []);

  const handleOpenSharedContact = useCallback(
    (contact: SharedContactCard) => {
      if (!contact.user_id || !onViewProfile) return;
      const parts = contact.full_name.trim().split(/\s+/);
      const first_name = parts[0] || "Контакт";
      const last_name = parts.slice(1).join(" ");
      onViewProfile(contact.user_id, {
        first_name,
        last_name,
        avatar_url: contact.avatar_url || null,
      });
    },
    [onViewProfile],
  );

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
      prevMsg.sender_id === msg.sender_id;

    const sameAsNext =
      nextMsg &&
      !nextMsg.is_deleted &&
      nextMsg.sender_id === msg.sender_id &&
      idx + 1 < visibleMessages.length;

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
                      {conv.last_message_content
                        ? getMessagePreviewText(conv.last_message_content)
                        : "Начните общение"}
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

        <div
          className={`chats-page__chat-user-info ${
            isMultiSelectMode ? "chats-page__chat-user-info--selection" : ""
          }`}
        >
          {isMultiSelectMode ? (
            <span className="chats-page__chat-user-name chats-page__chat-user-name--selection">
              {"\u0412\u044b\u0431\u0440\u0430\u043d\u043e: "}{" "}
              {selectedMessageIds.size}
            </span>
          ) : (
            <>
              <span className="chats-page__chat-user-name">
                {getParticipantName(activeConversation.participant)}
              </span>
              {typingUser && (
                <span className="chats-page__typing">печатает...</span>
              )}
            </>
          )}
        </div>

        {isMultiSelectMode ? (
          <div className="chats-page__chat-avatar-placeholder" />
        ) : (
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
        )}
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
          const position = getMessagePosition(msg, idx);
          const sharedContact = parseSharedContactCard(msg.content);
          const showDate = shouldShowDateSeparator(msg, idx);
          const isSelected = selectedMessageIds.has(msg.id);

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="chats-page__date-separator">
                  <span>{getDateLabel(msg.created_at)}</span>
                </div>
              )}
              {msg.id === firstUnreadMessageId && (
                <div className="chats-page__unread-separator">
                  <span>Непрочитанные</span>
                </div>
              )}
              <div
                className={`chats-page__message chats-page__message--${isOwn ? "own" : "other"} chats-page__message--${position} ${isSelected ? "chats-page__message--selected" : ""}`}
              >
                {isMultiSelectMode && !isOwn && (
                  <button
                    type="button"
                    className={`chats-page__message-side-marker ${isSelected ? "chats-page__message-side-marker--selected" : ""}`}
                    onClick={() => toggleMessageSelection(msg.id)}
                    aria-label={isSelected ? "Снять выбор" : "Выбрать сообщение"}
                  >
                    {isSelected && (
                      <svg
                        width="19"
                        height="19"
                        viewBox="0 0 19 19"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M9.0791 18.1592C7.8252 18.1592 6.65039 17.9219 5.55469 17.4473C4.45898 16.9785 3.49512 16.3281 2.66309 15.4961C1.83105 14.6641 1.17773 13.7002 0.703125 12.6045C0.234375 11.5088 0 10.334 0 9.08008C0 7.82617 0.234375 6.65137 0.703125 5.55566C1.17773 4.4541 1.83105 3.49023 2.66309 2.66406C3.49512 1.83203 4.45898 1.18164 5.55469 0.712891C6.65039 0.238281 7.8252 0.000976562 9.0791 0.000976562C10.333 0.000976562 11.5078 0.238281 12.6035 0.712891C13.7051 1.18164 14.6719 1.83203 15.5039 2.66406C16.3359 3.49023 16.9863 4.4541 17.4551 5.55566C17.9297 6.65137 18.167 7.82617 18.167 9.08008C18.167 10.334 17.9297 11.5088 17.4551 12.6045C16.9863 13.7002 16.3359 14.6641 15.5039 15.4961C14.6719 16.3281 13.7051 16.9785 12.6035 17.4473C11.5078 17.9219 10.333 18.1592 9.0791 18.1592ZM8.10352 13.4131C8.26758 13.4131 8.41699 13.375 8.55176 13.2988C8.69238 13.2227 8.81543 13.1084 8.9209 12.9561L13.0342 6.54004C13.0928 6.44629 13.1455 6.34668 13.1924 6.24121C13.2393 6.12988 13.2627 6.02441 13.2627 5.9248C13.2627 5.69629 13.1748 5.51172 12.999 5.37109C12.8291 5.23047 12.6357 5.16016 12.4189 5.16016C12.1318 5.16016 11.8945 5.3125 11.707 5.61719L8.06836 11.4355L6.38086 9.29102C6.26367 9.14453 6.14941 9.04199 6.03809 8.9834C5.92676 8.9248 5.80078 8.89551 5.66016 8.89551C5.4375 8.89551 5.24707 8.97754 5.08887 9.1416C4.93652 9.2998 4.86035 9.49023 4.86035 9.71289C4.86035 9.82422 4.88086 9.93262 4.92188 10.0381C4.96289 10.1436 5.02148 10.2461 5.09766 10.3457L7.25098 12.9648C7.37988 13.123 7.51172 13.2373 7.64648 13.3076C7.78125 13.3779 7.93359 13.4131 8.10352 13.4131Z"
                          fill="#0081FF"
                        />
                      </svg>
                    )}
                  </button>
                )}
                <div
                  className={`chats-page__bubble ${
                    isMultiSelectMode ? "chats-page__bubble--selection-mode" : ""
                  }`}
                  onContextMenu={(e) => {
                    if (isMultiSelectMode) {
                      e.preventDefault();
                      return;
                    }
                    messageActions.openActionMenu(e, msg);
                  }}
                  onTouchStart={(e) =>
                    isMultiSelectMode
                      ? undefined
                      : messageActions.handleMessageTouchStart(e, msg)
                  }
                  onTouchEnd={
                    isMultiSelectMode ? undefined : messageActions.handleMessageTouchEnd
                  }
                  onTouchCancel={
                    isMultiSelectMode ? undefined : messageActions.handleMessageTouchEnd
                  }
                  onTouchMove={
                    isMultiSelectMode ? undefined : messageActions.handleMessageTouchMove
                  }
                  onClick={() => {
                    if (isMultiSelectMode) toggleMessageSelection(msg.id);
                  }}
                >
                  {msg.reply_to_id && (
                    <div className="chats-page__bubble-reply">
                      <span className="chats-page__bubble-reply-author">
                        {(() => {
                          const replied = messagesById.get(msg.reply_to_id || "");
                          return replied ? getMessageAuthorLabel(replied) : "Сообщение";
                        })()}
                      </span>
                      <span className="chats-page__bubble-reply-text">
                        {(() => {
                          const replied = messagesById.get(msg.reply_to_id || "");
                          if (!replied) return "Сообщение недоступно";
                          return getMessagePreviewText(
                            replied.content || "Сообщение",
                          );
                        })()}
                      </span>
                    </div>
                  )}
                  {msg.forwarded_from_name && (
                    <p className="chats-page__bubble-forwarded">
                      ↪ Переслано от {msg.forwarded_from_name}
                    </p>
                  )}
                  {sharedContact ? (
                    <button
                      type="button"
                      className={`chats-page__shared-contact ${
                        sharedContact.user_id && onViewProfile
                          ? "chats-page__shared-contact--clickable"
                          : ""
                      }`}
                      onClick={() => {
                        if (isMultiSelectMode) {
                          toggleMessageSelection(msg.id);
                          return;
                        }
                        handleOpenSharedContact(sharedContact);
                      }}
                      disabled={
                        (!sharedContact.user_id || !onViewProfile) && !isMultiSelectMode
                      }
                    >
                      <div className="chats-page__shared-contact-top">
                        <Avatar
                          src={sharedContact.avatar_url || undefined}
                          initials={getInitialsFromFullName(sharedContact.full_name)}
                          size="sm"
                        />
                        <div className="chats-page__shared-contact-info">
                          <div className="chats-page__shared-contact-name">
                            {sharedContact.full_name}
                          </div>
                          {sharedContact.role && (
                            <div className="chats-page__shared-contact-role">
                              {sharedContact.role}
                            </div>
                          )}
                        </div>
                      </div>
                      {(sharedContact.contacts || []).slice(0, 3).map((item, i) => (
                        <div
                          key={`${item.type}-${item.value}-${i}`}
                          className="chats-page__shared-contact-item"
                        >
                          <span className="chats-page__shared-contact-type">
                            {item.type}
                          </span>
                          <span className="chats-page__shared-contact-value">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </button>
                  ) : (
                    <p className="chats-page__bubble-text">{msg.content}</p>
                  )}
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
                </div>
                {isMultiSelectMode && isOwn && (
                  <button
                    type="button"
                    className={`chats-page__message-side-marker ${isSelected ? "chats-page__message-side-marker--selected" : ""}`}
                    onClick={() => toggleMessageSelection(msg.id)}
                    aria-label={isSelected ? "Снять выбор" : "Выбрать сообщение"}
                  >
                    {isSelected && (
                      <svg
                        width="19"
                        height="19"
                        viewBox="0 0 19 19"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M9.0791 18.1592C7.8252 18.1592 6.65039 17.9219 5.55469 17.4473C4.45898 16.9785 3.49512 16.3281 2.66309 15.4961C1.83105 14.6641 1.17773 13.7002 0.703125 12.6045C0.234375 11.5088 0 10.334 0 9.08008C0 7.82617 0.234375 6.65137 0.703125 5.55566C1.17773 4.4541 1.83105 3.49023 2.66309 2.66406C3.49512 1.83203 4.45898 1.18164 5.55469 0.712891C6.65039 0.238281 7.8252 0.000976562 9.0791 0.000976562C10.333 0.000976562 11.5078 0.238281 12.6035 0.712891C13.7051 1.18164 14.6719 1.83203 15.5039 2.66406C16.3359 3.49023 16.9863 4.4541 17.4551 5.55566C17.9297 6.65137 18.167 7.82617 18.167 9.08008C18.167 10.334 17.9297 11.5088 17.4551 12.6045C16.9863 13.7002 16.3359 14.6641 15.5039 15.4961C14.6719 16.3281 13.7051 16.9785 12.6035 17.4473C11.5078 17.9219 10.333 18.1592 9.0791 18.1592ZM8.10352 13.4131C8.26758 13.4131 8.41699 13.375 8.55176 13.2988C8.69238 13.2227 8.81543 13.1084 8.9209 12.9561L13.0342 6.54004C13.0928 6.44629 13.1455 6.34668 13.1924 6.24121C13.2393 6.12988 13.2627 6.02441 13.2627 5.9248C13.2627 5.69629 13.1748 5.51172 12.999 5.37109C12.8291 5.23047 12.6357 5.16016 12.4189 5.16016C12.1318 5.16016 11.8945 5.3125 11.707 5.61719L8.06836 11.4355L6.38086 9.29102C6.26367 9.14453 6.14941 9.04199 6.03809 8.9834C5.92676 8.9248 5.80078 8.89551 5.66016 8.89551C5.4375 8.89551 5.24707 8.97754 5.08887 9.1416C4.93652 9.2998 4.86035 9.49023 4.86035 9.71289C4.86035 9.82422 4.88086 9.93262 4.92188 10.0381C4.96289 10.1436 5.02148 10.2461 5.09766 10.3457L7.25098 12.9648C7.37988 13.123 7.51172 13.2373 7.64648 13.3076C7.78125 13.3779 7.93359 13.4131 8.10352 13.4131Z"
                          fill="#0081FF"
                        />
                      </svg>
                    )}
                  </button>
                )}
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
        onReplyMessage={handleReplyMessage}
        onStartMultiSelect={startMultiSelectMode}
        onForwardComplete={handleForwardComplete}
      />

      <Modal
        isOpen={isMultiDeleteOpen && isMultiSelectMode}
        onClose={() => setIsMultiDeleteOpen(false)}
      >
        <div className="chats-page__modal">
          <h3 className="chats-page__modal-title">{"\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f?"}</h3>
          <p className="chats-page__modal-text">
            {"\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435, \u043a\u0430\u043a \u0443\u0434\u0430\u043b\u0438\u0442\u044c"} {selectedMessages.length}{" "}
            {selectedMessages.length === 1
              ? "\u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435"
              : "\u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f"}
            .
          </p>
          <div className="chats-page__modal-actions">
            <button
              type="button"
              className="chats-page__modal-btn"
              onClick={() => {
                void handleDeleteSelectedForMe();
              }}
            >
              {"\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0443 \u043c\u0435\u043d\u044f"}
            </button>
            <button
              type="button"
              className="chats-page__modal-btn chats-page__modal-btn--danger"
              onClick={handleDeleteSelectedForEveryone}
            >
              {"\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0443 \u0432\u0441\u0435\u0445"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Ввод сообщения */}
      <div className="chats-page__input-area">
        {isMultiSelectMode ? (
          <div className="chats-page__selection-actions">
            <div className="chats-page__selection-actions-row">
              <div className="chats-page__selection-action">
                <IconButton
                  variant="default"
                  size="md"
                  onClick={handleForwardSelected}
                  disabled={!canForwardSelected}
                  aria-label="Переслать выбранные"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" />
                    <path
                      d="M22 2L15 22L11 13L2 9L22 2Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </IconButton>
                <span>Переслать</span>
              </div>
              <div className="chats-page__selection-action">
                <IconButton
                  variant="danger"
                  size="md"
                  onClick={() => setIsMultiDeleteOpen(true)}
                  disabled={selectedMessages.length === 0}
                  aria-label="Удалить выбранные"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 6h18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M8 6V4h8v2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M19 6l-1 14H6L5 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </IconButton>
                <span>Удалить</span>
              </div>
              <div className="chats-page__selection-action">
                <IconButton
                  variant="ghost"
                  size="md"
                  onClick={exitMultiSelectMode}
                  aria-label="Отмена выбора"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M18 6L6 18M6 6l12 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </IconButton>
                <span>Отмена</span>
              </div>
            </div>
          </div>
        ) : (
          <>
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
                    {getMessagePreviewText(
                      messages.find((m) => m.id === messageActions.editingMessageId)
                        ?.content || "",
                    )}
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
            {!messageActions.editingMessageId && replyToMessage && (
              <div className="chats-page__edit-bar chats-page__reply-bar">
                <div className="chats-page__edit-info">
                  <span className="chats-page__edit-title">
                    Ответ {getMessageAuthorLabel(replyToMessage)}
                  </span>
                  <span className="chats-page__edit-preview">
                    {getMessagePreviewText(replyToMessage.content)}
                  </span>
                </div>
                <button
                  type="button"
                  className="chats-page__edit-cancel"
                  onClick={() => setReplyToMessage(null)}
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
                      : replyToMessage
                        ? "\u041E\u0442\u0432\u0435\u0442..."
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
                  className="chats-page__send-btn-glow"
                  width="56"
                  height="56"
                  viewBox="0 0 56 56"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <g filter="url(#sendGlowFilter)">
                    <rect
                      x="10"
                      y="10"
                      width="42"
                      height="42"
                      rx="21"
                      fill="url(#sendGlowGradient)"
                      fillOpacity="0.4"
                    />
                  </g>
                  <defs>
                    <filter
                      id="sendGlowFilter"
                      x="0"
                      y="0"
                      width="62"
                      height="62"
                      filterUnits="userSpaceOnUse"
                      colorInterpolationFilters="sRGB"
                    >
                      <feFlood floodOpacity="0" result="BackgroundImageFix" />
                      <feBlend
                        mode="normal"
                        in="SourceGraphic"
                        in2="BackgroundImageFix"
                        result="shape"
                      />
                      <feGaussianBlur
                        stdDeviation="5"
                        result="effect1_foregroundBlur"
                      />
                    </filter>
                    <radialGradient
                      id="sendGlowGradient"
                      cx="0"
                      cy="0"
                      r="1"
                      gradientUnits="userSpaceOnUse"
                      gradientTransform="translate(31 31) rotate(90) scale(30.7 42)"
                    >
                      <stop stopColor="#00C3FF" />
                      <stop offset="0.4" stopColor="#003FFF" />
                      <stop offset="1" stopColor="#007BFF" />
                    </radialGradient>
                  </defs>
                </svg>
                <svg
                  className="chats-page__send-btn-icon"
                  width="42"
                  height="42"
                  viewBox="0 0 42 42"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect width="42" height="42" rx="21" fill="white" fillOpacity="0.3" />
                  <path
                    d="M14.0156 19.7852C13.7227 19.7852 13.4785 19.6875 13.2832 19.4922C13.0879 19.2969 12.9902 19.0495 12.9902 18.75C12.9902 18.457 13.1009 18.1966 13.3223 17.9688L19.7578 11.5234C19.8685 11.4128 19.9922 11.3281 20.1289 11.2695C20.2656 11.2109 20.4056 11.1816 20.5488 11.1816C20.6986 11.1816 20.8418 11.2109 20.9785 11.2695C21.1217 11.3281 21.2454 11.4128 21.3496 11.5234L27.7852 17.9688C28.0065 18.1966 28.1172 18.457 28.1172 18.75C28.1172 19.0495 28.0195 19.2969 27.8242 19.4922C27.6289 19.6875 27.3848 19.7852 27.0918 19.7852C26.9421 19.7852 26.8021 19.7591 26.6719 19.707C26.5417 19.6484 26.4277 19.5703 26.3301 19.4727L24.1133 17.2852L20.5488 13.3008L16.9844 17.2852L14.7773 19.4727C14.6797 19.5703 14.5658 19.6484 14.4355 19.707C14.3053 19.7591 14.1654 19.7852 14.0156 19.7852ZM20.5488 29.7266C20.2363 29.7266 19.9792 29.6257 19.7773 29.4238C19.582 29.222 19.4844 28.9616 19.4844 28.6426V16.5234L19.6016 13.3398C19.6016 13.0469 19.6895 12.8125 19.8652 12.6367C20.041 12.4544 20.2689 12.3633 20.5488 12.3633C20.8353 12.3633 21.0664 12.4544 21.2422 12.6367C21.418 12.8125 21.5059 13.0469 21.5059 13.3398L21.623 16.5234V28.6426C21.623 28.9616 21.5221 29.222 21.3203 29.4238C21.125 29.6257 20.8678 29.7266 20.5488 29.7266Z"
                    fill="black"
                  />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
