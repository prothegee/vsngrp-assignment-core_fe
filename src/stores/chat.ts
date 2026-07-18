import { defineStore } from "pinia";
import { ref } from "vue";
import { useAuthStore } from "./auth";
import {
  ChatWsClient,
  maxMessageContentBytes,
  type ChatMessage,
  type ConnectionStatus,
  type Conversation,
  type ServerMessage,
} from "../services/wsClient";

export type DisplayChatMessage = ChatMessage & { pending?: boolean };

export type SendMessageResult = "sent" | "empty" | "too_large" | "no_active_conversation";

export const useChatStore = defineStore("chat", () => {
  const authStore = useAuthStore();

  const connectionStatus = ref<ConnectionStatus>("closed");
  const conversations = ref<Conversation[]>([]);
  const activeConversationId = ref<string | null>(null);
  const messagesByConversation = ref<Record<string, DisplayChatMessage[]>>({});
  const isSending = ref(false);
  const lastError = ref<string | null>(null);

  const wsClient = new ChatWsClient(() => authStore.accessToken);
  let unsubscribeMessage: (() => void) | null = null;
  let unsubscribeStatus: (() => void) | null = null;

  function connect(): void {
    if (unsubscribeMessage === null) {
      unsubscribeMessage = wsClient.onMessage(handleServerMessage);
    }
    if (unsubscribeStatus === null) {
      unsubscribeStatus = wsClient.onStatusChange(handleStatusChange);
    }

    wsClient.connect();
  }

  function disconnect(): void {
    wsClient.disconnect();

    unsubscribeMessage?.();
    unsubscribeStatus?.();
    unsubscribeMessage = null;
    unsubscribeStatus = null;
  }

  function createConversation(title: string): void {
    const trimmedTitle = title.trim();
    if (trimmedTitle === "") {
      return;
    }

    wsClient.createConversation(trimmedTitle);
  }

  function selectConversation(conversationId: string): void {
    activeConversationId.value = conversationId;

    wsClient.openConversation(conversationId);
  }

  function renameConversation(conversationId: string, title: string): void {
    const trimmedTitle = title.trim();
    if (trimmedTitle === "") {
      return;
    }

    wsClient.renameConversation(conversationId, trimmedTitle);
  }

  function deleteConversation(conversationId: string): void {
    wsClient.deleteConversation(conversationId);
  }

  function sendMessage(content: string): SendMessageResult {
    const conversationId = activeConversationId.value;
    if (conversationId === null) {
      return "no_active_conversation";
    }

    const trimmedContent = content.trim();
    if (trimmedContent === "") {
      return "empty";
    }

    if (new TextEncoder().encode(trimmedContent).length > maxMessageContentBytes) {
      return "too_large";
    }

    const messages = messagesByConversation.value[conversationId] ?? [];
    messages.push({ role: "user", content: trimmedContent, timestamp: new Date().toISOString() });
    messagesByConversation.value[conversationId] = messages;

    isSending.value = true;
    wsClient.sendChatMessage(conversationId, trimmedContent);

    return "sent";
  }

  function handleStatusChange(status: ConnectionStatus): void {
    connectionStatus.value = status;

    if (status !== "open") {
      return;
    }

    wsClient.listConversations();
    if (activeConversationId.value !== null) {
      wsClient.openConversation(activeConversationId.value);
    }
  }

  function handleServerMessage(message: ServerMessage): void {
    switch (message.type) {
      case "auth_error":
        lastError.value = message.error;
        break;
      case "error":
        lastError.value = message.error;
        isSending.value = false;
        break;
      case "conversation_created":
        conversations.value = [message.conversation, ...conversations.value];
        selectConversation(message.conversation.id);
        break;
      case "conversation_list":
        conversations.value = message.conversations;
        break;
      case "conversation_renamed": {
        const conversation = conversations.value.find((item) => item.id === message.conversationId);
        if (conversation) {
          conversation.title = message.title;
        }
        break;
      }
      case "conversation_deleted":
        conversations.value = conversations.value.filter((item) => item.id !== message.conversationId);
        delete messagesByConversation.value[message.conversationId];
        if (activeConversationId.value === message.conversationId) {
          activeConversationId.value = null;
        }
        break;
      case "conversation_history":
        messagesByConversation.value[message.conversationId] = message.messages;
        break;
      case "message_chunk":
        appendMessageChunk(message.conversationId, message.delta);
        break;
      case "message_complete":
        completeMessage(message.conversationId, message.message);
        break;
    }
  }

  function appendMessageChunk(conversationId: string, delta: string): void {
    const messages = messagesByConversation.value[conversationId] ?? [];
    const lastMessage = messages[messages.length - 1];

    if (lastMessage && lastMessage.role === "assistant" && lastMessage.pending) {
      lastMessage.content += delta;
    } else {
      messages.push({ role: "assistant", content: delta, timestamp: new Date().toISOString(), pending: true });
    }

    messagesByConversation.value[conversationId] = messages;
  }

  function completeMessage(conversationId: string, finalMessage: ChatMessage): void {
    const messages = messagesByConversation.value[conversationId] ?? [];
    if (messages.length > 0 && messages[messages.length - 1].pending) {
      messages.pop();
    }

    messages.push({ ...finalMessage, pending: false });
    messagesByConversation.value[conversationId] = messages;
    isSending.value = false;
  }

  return {
    connectionStatus,
    conversations,
    activeConversationId,
    messagesByConversation,
    isSending,
    lastError,
    connect,
    disconnect,
    createConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    sendMessage,
  };
});
