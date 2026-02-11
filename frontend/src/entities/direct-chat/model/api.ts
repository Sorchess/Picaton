import { api, tokenStorage } from "@/shared/api";
import type {
  ConversationListResponse,
  DMListResponse,
  DMUnreadResponse,
  DirectMessage,
  StartConversationRequest,
  StartConversationResponse,
  SendDMRequest,
} from "./types";

export const directChatApi = {
  // Диалоги
  getConversations: (limit = 50, offset = 0) =>
    api.get<ConversationListResponse>(
      `/dm/conversations?limit=${limit}&offset=${offset}`,
    ),

  startConversation: (data: StartConversationRequest) =>
    api.post<StartConversationResponse>("/dm/conversations", data),

  // Сообщения
  getMessages: (conversationId: string, limit = 50, before?: string) => {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    if (before) params.append("before", before);
    return api.get<DMListResponse>(
      `/dm/conversations/${conversationId}/messages?${params.toString()}`,
    );
  },

  sendMessage: (conversationId: string, data: SendDMRequest) =>
    api.post<DirectMessage>(
      `/dm/conversations/${conversationId}/messages`,
      data,
    ),

  editMessage: (conversationId: string, messageId: string, content: string) =>
    api.put<DirectMessage>(
      `/dm/conversations/${conversationId}/messages/${messageId}`,
      { content },
    ),

  deleteMessage: (conversationId: string, messageId: string) =>
    api.delete(`/dm/conversations/${conversationId}/messages/${messageId}`),

  // Прочитано
  markAsRead: (conversationId: string) =>
    api.post<{ marked_count: number }>(
      `/dm/conversations/${conversationId}/read`,
    ),

  // Непрочитанные
  getUnread: () => api.get<DMUnreadResponse>("/dm/unread"),
};

// WebSocket клиент для прямых сообщений
interface DMWebSocketCallbacks {
  onMessage?: (data: { type: string; [key: string]: unknown }) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: unknown) => void;
}

export class DMWebSocket {
  private ws: WebSocket | null = null;
  private callbacks: DMWebSocketCallbacks;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private shouldReconnect = true;

  constructor(callbacks: DMWebSocketCallbacks) {
    this.callbacks = callbacks;
  }

  connect(): void {
    const token = tokenStorage.get();
    if (!token) {
      console.error("No auth token for DM WebSocket");
      return;
    }

    const wsUrl = this.getWebSocketUrl(token);
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.startPing();
      this.callbacks.onConnected?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== "pong") {
          this.callbacks.onMessage?.(data);
        }
      } catch (e) {
        console.error("Failed to parse DM WebSocket message:", e);
      }
    };

    this.ws.onclose = () => {
      this.stopPing();
      this.callbacks.onDisconnected?.();

      if (
        this.shouldReconnect &&
        this.reconnectAttempts < this.maxReconnectAttempts
      ) {
        this.reconnectAttempts++;
        setTimeout(
          () => this.connect(),
          this.reconnectDelay * this.reconnectAttempts,
        );
      }
    };

    this.ws.onerror = (error) => {
      this.callbacks.onError?.(error);
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private send(message: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  sendMessage(
    conversationId: string,
    content: string,
    replyToId?: string,
  ): void {
    this.send({
      type: "send_message",
      conversation_id: conversationId,
      content,
      reply_to_id: replyToId,
    });
  }

  sendTyping(conversationId: string, isTyping: boolean): void {
    this.send({
      type: "typing",
      conversation_id: conversationId,
      is_typing: isTyping,
    });
  }

  editMessage(
    conversationId: string,
    messageId: string,
    content: string,
  ): void {
    this.send({
      type: "edit_message",
      conversation_id: conversationId,
      message_id: messageId,
      content,
    });
  }

  deleteMessage(conversationId: string, messageId: string): void {
    this.send({
      type: "delete_message",
      conversation_id: conversationId,
      message_id: messageId,
    });
  }

  markRead(conversationId: string): void {
    this.send({
      type: "mark_read",
      conversation_id: conversationId,
    });
  }

  private getWebSocketUrl(token: string): string {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${protocol}//${host}/api/ws/dm?token=${token}`;
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
