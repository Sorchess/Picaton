// Типы для прямых сообщений

export interface DMAuthor {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender?: DMAuthor | null;
  content: string;
  is_read: boolean;
  is_edited: boolean;
  edited_at?: string | null;
  is_deleted: boolean;
  reply_to_id?: string | null;
  forwarded_from_user_id?: string | null;
  forwarded_from_name?: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  participant: DMAuthor;
  last_message_content: string | null;
  last_message_sender_id: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
}

export interface ConversationListResponse {
  conversations: Conversation[];
}

export interface DMListResponse {
  messages: DirectMessage[];
  has_more: boolean;
}

export interface DMUnreadResponse {
  total: number;
  counts: Record<string, number>;
}

export interface SendDMRequest {
  content: string;
  reply_to_id?: string | null;
}

export interface StartConversationRequest {
  recipient_id: string;
  content?: string;
}

export interface StartConversationResponse {
  conversation: Conversation;
  message: DirectMessage;
}

// WebSocket типы
export interface WSDMNewMessage {
  type: "new_message";
  message: {
    id: string;
    conversation_id: string;
    sender_id: string;
    sender_name: string;
    content: string;
    reply_to_id: string | null;
    forwarded_from_user_id?: string | null;
    forwarded_from_name?: string | null;
    is_read: boolean;
    created_at: string;
  };
}

export interface WSDMTyping {
  type: "typing";
  conversation_id: string;
  user_id: string;
  user_name: string;
  is_typing: boolean;
}

export interface WSDMMessageEdited {
  type: "message_edited";
  message_id: string;
  conversation_id: string;
  content: string;
  edited_at: string;
}

export interface WSDMMessageDeleted {
  type: "message_deleted";
  message_id: string;
  conversation_id: string;
}

export interface WSDMReadReceipt {
  type: "read_receipt";
  conversation_id: string;
  user_id: string;
  read_at: string;
}

export interface WSDMMessageHiddenForUser {
  type: "message_hidden_for_user";
  message_id: string;
  conversation_id: string;
}

export type WSDMMessage =
  | WSDMNewMessage
  | WSDMTyping
  | WSDMMessageEdited
  | WSDMMessageDeleted
  | WSDMMessageHiddenForUser
  | WSDMReadReceipt
  | { type: "pong" }
  | { type: "error"; message: string };

// Утилиты
export function getParticipantName(participant: DMAuthor): string {
  return `${participant.first_name} ${participant.last_name}`.trim();
}

export function getParticipantInitials(participant: DMAuthor): string {
  const first = participant.first_name?.[0] || "";
  const last = participant.last_name?.[0] || "";
  return (first + last).toUpperCase() || "?";
}

export function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  const time = date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (messageDate.getTime() === today.getTime()) {
    return time;
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (messageDate.getTime() === yesterday.getTime()) {
    return `Вчера, ${time}`;
  }

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatConversationTime(dateStr: string | null): string {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  if (messageDate.getTime() === today.getTime()) {
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (messageDate.getTime() === yesterday.getTime()) {
    return "Вчера";
  }

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  if (messageDate.getTime() > weekAgo.getTime()) {
    return date.toLocaleDateString("ru-RU", { weekday: "short" });
  }

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}
