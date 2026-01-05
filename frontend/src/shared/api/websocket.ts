/**
 * WebSocket client for real-time AI generation.
 *
 * Handles connection, reconnection, and message handling
 * for streaming bio generation and tag suggestions.
 */

export type WSMessageType =
  | "chunk"
  | "complete"
  | "error"
  | "tags_update"
  | "start"
  | "pong";

export interface WSMessage {
  type: WSMessageType;
  content?: string;
  full_bio?: string;
  message?: string;
  tags?: Array<{
    name: string;
    category: string;
    confidence: number;
    reason: string;
  }>;
}

type MessageHandler = (data: WSMessage) => void;

interface AIWebSocketClientOptions {
  /** Максимальное количество попыток переподключения */
  maxReconnectAttempts?: number;
  /** Задержка между попытками переподключения (мс) */
  reconnectDelay?: number;
  /** Интервал пинга для поддержания соединения (мс) */
  pingInterval?: number;
}

export class AIWebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Map<WSMessageType, MessageHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private pingInterval: number;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private connectionPromise: Promise<void> | null = null;
  private cardId: string | null = null;
  private ownerId: string | null = null;
  private baseUrl: string;

  constructor(baseUrl: string, options: AIWebSocketClientOptions = {}) {
    this.baseUrl = baseUrl;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 3;
    this.reconnectDelay = options.reconnectDelay ?? 2000;
    this.pingInterval = options.pingInterval ?? 30000;
  }

  /**
   * Connect to WebSocket server for a specific card.
   */
  async connect(cardId: string, ownerId: string): Promise<void> {
    // If already connecting, wait for it
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // If already connected to the same card, return
    if (
      this.ws?.readyState === WebSocket.OPEN &&
      this.cardId === cardId &&
      this.ownerId === ownerId
    ) {
      return;
    }

    // Disconnect from previous connection
    this.disconnect();

    this.cardId = cardId;
    this.ownerId = ownerId;

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        // Convert HTTP URL to WebSocket URL and remove /api suffix if present
        const wsUrl = this.baseUrl
          .replace(/^http/, "ws")
          .replace(/\/api\/?$/, "")
          .replace(/\/$/, "");

        const url = `${wsUrl}/api/ws/cards/${cardId}?owner_id=${ownerId}`;

        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log("[WS] Connected");
          this.reconnectAttempts = 0;
          this.startPing();
          this.connectionPromise = null;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data: WSMessage = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (e) {
            console.error("[WS] Failed to parse message:", e);
          }
        };

        this.ws.onerror = (error) => {
          console.error("[WS] Error:", error);
          this.connectionPromise = null;
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log("[WS] Closed:", event.code, event.reason);
          this.stopPing();
          this.handleClose(event);
        };
      } catch (error) {
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Disconnect from WebSocket server.
   */
  disconnect(): void {
    this.stopPing();

    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnection
      this.ws.close();
      this.ws = null;
    }

    this.cardId = null;
    this.ownerId = null;
    this.connectionPromise = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Subscribe to a message type.
   * Returns unsubscribe function.
   */
  on(type: WSMessageType, handler: MessageHandler): () => void {
    const handlers = this.handlers.get(type) || [];
    handlers.push(handler);
    this.handlers.set(type, handlers);

    // Return unsubscribe function
    return () => {
      const currentHandlers = this.handlers.get(type) || [];
      const idx = currentHandlers.indexOf(handler);
      if (idx > -1) {
        currentHandlers.splice(idx, 1);
        this.handlers.set(type, currentHandlers);
      }
    };
  }

  /**
   * Send a message to the server.
   */
  send(action: string, data: Record<string, unknown> = {}): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn("[WS] Cannot send, not connected");
      return false;
    }

    try {
      this.ws.send(JSON.stringify({ action, ...data }));
      return true;
    } catch (e) {
      console.error("[WS] Send error:", e);
      return false;
    }
  }

  /**
   * Check if connected.
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection state.
   */
  get state(): "connecting" | "connected" | "disconnected" {
    if (this.connectionPromise) return "connecting";
    if (this.ws?.readyState === WebSocket.OPEN) return "connected";
    return "disconnected";
  }

  private handleMessage(data: WSMessage): void {
    const handlers = this.handlers.get(data.type) || [];
    handlers.forEach((handler) => {
      try {
        handler(data);
      } catch (e) {
        console.error("[WS] Handler error:", e);
      }
    });
  }

  private handleClose(event: CloseEvent): void {
    // Don't reconnect if closed normally
    if (event.code === 1000) return;

    // Don't reconnect if max attempts reached
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("[WS] Max reconnection attempts reached");
      return;
    }

    // Don't reconnect if no card/owner
    if (!this.cardId || !this.ownerId) return;

    this.reconnectAttempts++;
    console.log(
      `[WS] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})`
    );

    setTimeout(() => {
      if (this.cardId && this.ownerId) {
        this.connect(this.cardId, this.ownerId).catch((e) => {
          console.error("[WS] Reconnection failed:", e);
        });
      }
    }, this.reconnectDelay);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.send("ping");
    }, this.pingInterval);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

// Default instance with API URL from environment
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const aiWebSocket = new AIWebSocketClient(API_URL);

export default aiWebSocket;
