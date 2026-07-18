export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  accountId: string;
  title: string;
  createdAt: string;
}

interface AuthOkMessage {
  type: "auth_ok";
}

interface AuthErrorMessage {
  type: "auth_error";
  error: string;
}

interface ErrorMessage {
  type: "error";
  error: string;
}

interface ConversationCreatedMessage {
  type: "conversation_created";
  conversation: Conversation;
}

interface ConversationListMessage {
  type: "conversation_list";
  conversations: Conversation[];
}

interface ConversationRenamedMessage {
  type: "conversation_renamed";
  conversationId: string;
  title: string;
}

interface ConversationDeletedMessage {
  type: "conversation_deleted";
  conversationId: string;
}

interface ConversationHistoryMessage {
  type: "conversation_history";
  conversationId: string;
  messages: ChatMessage[];
}

interface MessageChunkMessage {
  type: "message_chunk";
  conversationId: string;
  delta: string;
}

interface MessageCompleteMessage {
  type: "message_complete";
  conversationId: string;
  message: ChatMessage;
}

export type ServerMessage =
  | AuthOkMessage
  | AuthErrorMessage
  | ErrorMessage
  | ConversationCreatedMessage
  | ConversationListMessage
  | ConversationRenamedMessage
  | ConversationDeletedMessage
  | ConversationHistoryMessage
  | MessageChunkMessage
  | MessageCompleteMessage;

export type ConnectionStatus = "connecting" | "open" | "closed";

type ServerMessageHandler = (message: ServerMessage) => void;
type ConnectionStatusHandler = (status: ConnectionStatus) => void;

const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL;

// Leaves headroom under the server's 64 KiB per-frame cap (ChatWebSocketHandler.MaxMessageSizeBytes)
// for the surrounding JSON envelope, so a client-side reject never disagrees with the server's own check.
export const maxMessageContentBytes = 60 * 1024;

const maxReconnectDelayMs = 10000;

export class ChatWsClient {
  private readonly getAccessToken: () => string | null;
  private readonly messageListeners = new Set<ServerMessageHandler>();
  private readonly statusListeners = new Set<ConnectionStatusHandler>();
  private socket: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;

  constructor(getAccessToken: () => string | null) {
    this.getAccessToken = getAccessToken;
  }

  connect(): void {
    this.shouldReconnect = true;

    this.openSocket();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();

    this.socket?.close();
    this.socket = null;
  }

  onMessage(handler: ServerMessageHandler): () => void {
    this.messageListeners.add(handler);

    return () => this.messageListeners.delete(handler);
  }

  onStatusChange(handler: ConnectionStatusHandler): () => void {
    this.statusListeners.add(handler);

    return () => this.statusListeners.delete(handler);
  }

  createConversation(title: string): void {
    this.send({ type: "create_conversation", title });
  }

  listConversations(): void {
    this.send({ type: "list_conversations" });
  }

  renameConversation(conversationId: string, title: string): void {
    this.send({ type: "rename_conversation", conversationId, title });
  }

  deleteConversation(conversationId: string): void {
    this.send({ type: "delete_conversation", conversationId });
  }

  openConversation(conversationId: string): void {
    this.send({ type: "open_conversation", conversationId });
  }

  sendChatMessage(conversationId: string, content: string): void {
    this.send({ type: "send_message", conversationId, content });
  }

  private send(message: Record<string, unknown>): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(message));
  }

  private openSocket(): void {
    const socket = new WebSocket(`${wsBaseUrl}/ws/chat`);
    this.socket = socket;

    this.emitStatus("connecting");

    socket.addEventListener("open", () => {
      const accessToken = this.getAccessToken();
      if (accessToken === null) {
        socket.close();
        return;
      }

      socket.send(JSON.stringify({ type: "auth", token: accessToken }));
    });

    socket.addEventListener("message", (event) => {
      let parsed: ServerMessage;
      try {
        parsed = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return;
      }

      if (parsed.type === "auth_ok") {
        this.reconnectAttempt = 0;
        this.emitStatus("open");
      }

      this.emitMessage(parsed);
    });

    socket.addEventListener("close", () => {
      this.socket = null;

      this.emitStatus("closed");
      this.scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      socket.close();
    });
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) {
      return;
    }

    this.clearReconnectTimer();

    const delayMs = Math.min(1000 * 2 ** this.reconnectAttempt, maxReconnectDelayMs);
    this.reconnectAttempt += 1;

    this.reconnectTimeoutId = setTimeout(() => {
      this.openSocket();
    }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimeoutId === null) {
      return;
    }

    clearTimeout(this.reconnectTimeoutId);
    this.reconnectTimeoutId = null;
  }

  private emitMessage(message: ServerMessage): void {
    for (const listener of this.messageListeners) {
      listener(message);
    }
  }

  private emitStatus(status: ConnectionStatus): void {
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }
}
