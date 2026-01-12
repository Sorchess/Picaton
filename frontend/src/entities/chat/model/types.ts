// Типы для чата

export type MessageType = "text" | "system" | "file" | "image";

export interface MessageAuthor {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

export interface ChatMessage {
  id: string;
  project_id: string;
  author_id?: string | null;
  author?: MessageAuthor | null;
  content: string;
  message_type: MessageType;
  file_url?: string | null;
  file_name?: string | null;
  reply_to_id?: string | null;
  is_edited: boolean;
  edited_at?: string | null;
  is_deleted: boolean;
  created_at: string;
  is_read: boolean;
}

export interface MessageListResponse {
  messages: ChatMessage[];
  has_more: boolean;
}

export interface SendMessageRequest {
  content: string;
  reply_to_id?: string | null;
}

export interface EditMessageRequest {
  content: string;
}

export interface UnreadCountResponse {
  project_id: string;
  count: number;
}

export interface UnreadCountsResponse {
  counts: Record<string, number>;
  total: number;
}

export interface MarkAsReadResponse {
  marked_count: number;
}

// WebSocket типы
export interface WSNewMessage {
  type: "new_message";
  message: {
    id: string;
    project_id: string;
    author_id: string;
    author_name: string;
    author_avatar: string | null;
    content: string;
    message_type: MessageType;
    reply_to_id: string | null;
    created_at: string;
  };
}

export interface WSTypingIndicator {
  type: "typing";
  user_id: string;
  user_name: string;
  is_typing: boolean;
}

export interface WSMessageEdited {
  type: "message_edited";
  message_id: string;
  new_content: string;
  edited_at: string;
}

export interface WSMessageDeleted {
  type: "message_deleted";
  message_id: string;
}

export interface WSUserJoined {
  type: "user_joined";
  user_id: string;
  user_name: string;
  online_users: string[];
}

export interface WSUserLeft {
  type: "user_left";
  user_id: string;
  user_name: string;
  online_users: string[];
}

export interface WSReadReceipt {
  type: "read_receipt";
  user_id: string;
  project_id: string;
  read_at: string;
}

export type WSChatMessage =
  | WSNewMessage
  | WSTypingIndicator
  | WSMessageEdited
  | WSMessageDeleted
  | WSUserJoined
  | WSUserLeft
  | WSReadReceipt
  | { type: "pong" }
  | { type: "error"; message: string };

// Helper функции
export function getAuthorName(message: ChatMessage): string {
  if (!message.author) return "Система";
  return `${message.author.first_name} ${message.author.last_name}`.trim();
}

export function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
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

export function isSystemMessage(message: ChatMessage): boolean {
  return message.message_type === "system";
}
