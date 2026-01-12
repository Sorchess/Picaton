import { api } from "@/shared/api";
import type {
  ChatMessage,
  MessageListResponse,
  SendMessageRequest,
  EditMessageRequest,
  UnreadCountResponse,
  UnreadCountsResponse,
  MarkAsReadResponse,
} from "./types";

export const chatApi = {
  // Сообщения
  getMessages: (
    projectId: string,
    limit = 50,
    before?: string,
    after?: string
  ) => {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    if (before) params.append("before", before);
    if (after) params.append("after", after);
    return api.get<MessageListResponse>(
      `/projects/${projectId}/chat/messages?${params.toString()}`
    );
  },

  sendMessage: (projectId: string, data: SendMessageRequest) =>
    api.post<ChatMessage>(`/projects/${projectId}/chat/messages`, data),

  editMessage: (
    projectId: string,
    messageId: string,
    data: EditMessageRequest
  ) =>
    api.put<ChatMessage>(
      `/projects/${projectId}/chat/messages/${messageId}`,
      data
    ),

  deleteMessage: (projectId: string, messageId: string) =>
    api.delete(`/projects/${projectId}/chat/messages/${messageId}`),

  // Прочитано
  markAsRead: (projectId: string) =>
    api.post<MarkAsReadResponse>(`/projects/${projectId}/chat/read`),

  getUnreadCount: (projectId: string) =>
    api.get<UnreadCountResponse>(`/projects/${projectId}/chat/unread`),

  getAllUnreadCounts: () => api.get<UnreadCountsResponse>("/chat/unread"),

  // Поиск
  searchMessages: (projectId: string, query: string, limit = 20) =>
    api.get<MessageListResponse>(
      `/projects/${projectId}/chat/search?q=${encodeURIComponent(
        query
      )}&limit=${limit}`
    ),

  // Онлайн пользователи
  getOnlineUsers: (projectId: string) =>
    api.get<{ online_users: string[] }>(`/projects/${projectId}/chat/online`),
};

// WebSocket клиент для чата
interface ChatWebSocketCallbacks {
  onMessage?: (message: ChatMessage) => void;
  onTyping?: (userId: string, isTyping: boolean) => void;
  onUserJoined?: (userId: string) => void;
  onUserLeft?: (userId: string) => void;
  onError?: (error: unknown) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export class ChatWebSocket {
  private ws: WebSocket | null = null;
  private projectId: string;
  private token: string;
  private callbacks: ChatWebSocketCallbacks;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    projectId: string,
    token: string,
    callbacks: ChatWebSocketCallbacks
  ) {
    this.projectId = projectId;
    this.token = token;
    this.callbacks = callbacks;
  }

  connect(): void {
    const wsUrl = this.getWebSocketUrl();
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("Chat WebSocket connected");
      this.reconnectAttempts = 0;
      this.startPing();
      this.callbacks.onConnected?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    };

    this.ws.onclose = (event) => {
      console.log("Chat WebSocket closed:", event.code, event.reason);
      this.stopPing();
      this.callbacks.onDisconnected?.();

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(
          () => this.connect(),
          this.reconnectDelay * this.reconnectAttempts
        );
      }
    };

    this.ws.onerror = (error) => {
      console.error("Chat WebSocket error:", error);
      this.callbacks.onError?.(error);
    };
  }

  private handleMessage(data: { type: string; [key: string]: unknown }): void {
    switch (data.type) {
      case "new_message":
        if (this.callbacks.onMessage && data.message) {
          this.callbacks.onMessage(data.message as ChatMessage);
        }
        break;
      case "typing":
        if (this.callbacks.onTyping) {
          this.callbacks.onTyping(
            data.user_id as string,
            data.is_typing as boolean
          );
        }
        break;
      case "user_joined":
        if (this.callbacks.onUserJoined) {
          this.callbacks.onUserJoined(data.user_id as string);
        }
        break;
      case "user_left":
        if (this.callbacks.onUserLeft) {
          this.callbacks.onUserLeft(data.user_id as string);
        }
        break;
      case "pong":
        // Ignore pong
        break;
      default:
        console.log("Unknown WebSocket message type:", data.type);
    }
  }

  disconnect(): void {
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  send(message: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  sendMessage(content: string, replyToId?: string): void {
    this.send({
      type: "send_message",
      content,
      reply_to_id: replyToId,
    });
  }

  sendTyping(isTyping: boolean): void {
    this.send({
      type: "typing",
      is_typing: isTyping,
    });
  }

  editMessage(messageId: string, content: string): void {
    this.send({
      type: "edit_message",
      message_id: messageId,
      content,
    });
  }

  deleteMessage(messageId: string): void {
    this.send({
      type: "delete_message",
      message_id: messageId,
    });
  }

  markRead(): void {
    this.send({ type: "mark_read" });
  }

  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${protocol}//${host}/api/ws/chat/${this.projectId}?token=${this.token}`;
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      this.send({ type: "ping" });
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
