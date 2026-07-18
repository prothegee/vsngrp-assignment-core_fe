import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { ServerMessage } from "../../src/services/wsClient";

let messageHandler: ((message: ServerMessage) => void) | null = null;
let statusHandler: ((status: "connecting" | "open" | "closed") => void) | null = null;

const fakeClient = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  createConversation: vi.fn(),
  listConversations: vi.fn(),
  renameConversation: vi.fn(),
  deleteConversation: vi.fn(),
  openConversation: vi.fn(),
  sendChatMessage: vi.fn(),
  onMessage: vi.fn((handler: (message: ServerMessage) => void) => {
    messageHandler = handler;
    return () => {
      messageHandler = null;
    };
  }),
  onStatusChange: vi.fn((handler: (status: "connecting" | "open" | "closed") => void) => {
    statusHandler = handler;
    return () => {
      statusHandler = null;
    };
  }),
};

vi.mock("../../src/services/wsClient", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/wsClient")>("../../src/services/wsClient");
  return {
    ...actual,
    ChatWsClient: vi.fn().mockImplementation(function ChatWsClientMock() {
      return fakeClient;
    }),
  };
});

const { useChatStore } = await import("../../src/stores/chat");

describe("chat store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    messageHandler = null;
    statusHandler = null;
  });

  function connectAndAuthenticate(): ReturnType<typeof useChatStore> {
    const chatStore = useChatStore();
    chatStore.connect();
    statusHandler?.("open");
    return chatStore;
  }

  it("requests the conversation list once the connection is authenticated", () => {
    connectAndAuthenticate();

    expect(fakeClient.listConversations).toHaveBeenCalledTimes(1);
  });

  it("replaces the conversation list on a conversation_list message", () => {
    const chatStore = connectAndAuthenticate();

    messageHandler?.({
      type: "conversation_list",
      conversations: [{ id: "conv-1", accountId: "acc-1", title: "First", createdAt: "2026-01-01T00:00:00Z" }],
    });

    expect(chatStore.conversations).toHaveLength(1);
    expect(chatStore.conversations[0].title).toBe("First");
  });

  it("auto-selects a newly created conversation and opens it", () => {
    const chatStore = connectAndAuthenticate();

    messageHandler?.({
      type: "conversation_created",
      conversation: { id: "conv-2", accountId: "acc-1", title: "New chat", createdAt: "2026-01-01T00:00:00Z" },
    });

    expect(chatStore.activeConversationId).toBe("conv-2");
    expect(fakeClient.openConversation).toHaveBeenCalledWith("conv-2");
  });

  it("assembles streamed message_chunk deltas into a single pending assistant message", () => {
    const chatStore = connectAndAuthenticate();
    chatStore.activeConversationId = "conv-3";

    messageHandler?.({ type: "message_chunk", conversationId: "conv-3", delta: "Hel" });
    messageHandler?.({ type: "message_chunk", conversationId: "conv-3", delta: "lo" });

    const messages = chatStore.messagesByConversation["conv-3"];
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ role: "assistant", content: "Hello", pending: true });
  });

  it("replaces the pending assistant message with the finalized one on message_complete", () => {
    const chatStore = connectAndAuthenticate();
    chatStore.activeConversationId = "conv-4";

    messageHandler?.({ type: "message_chunk", conversationId: "conv-4", delta: "Hi" });
    messageHandler?.({
      type: "message_complete",
      conversationId: "conv-4",
      message: { role: "assistant", content: "Hi there", timestamp: "2026-01-01T00:00:01Z" },
    });

    const messages = chatStore.messagesByConversation["conv-4"];
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ role: "assistant", content: "Hi there", pending: false });
    expect(chatStore.isSending).toBe(false);
  });

  it("clears the active conversation when it is the one that got deleted", () => {
    const chatStore = connectAndAuthenticate();
    messageHandler?.({
      type: "conversation_created",
      conversation: { id: "conv-5", accountId: "acc-1", title: "Doomed", createdAt: "2026-01-01T00:00:00Z" },
    });
    expect(chatStore.activeConversationId).toBe("conv-5");

    messageHandler?.({ type: "conversation_deleted", conversationId: "conv-5" });

    expect(chatStore.activeConversationId).toBeNull();
    expect(chatStore.messagesByConversation["conv-5"]).toBeUndefined();
  });

  it("re-lists conversations and replays the active conversation's history after a reconnect", () => {
    const chatStore = connectAndAuthenticate();
    chatStore.activeConversationId = "conv-6";
    vi.clearAllMocks();

    statusHandler?.("closed");
    statusHandler?.("open");

    expect(fakeClient.listConversations).toHaveBeenCalledTimes(1);
    expect(fakeClient.openConversation).toHaveBeenCalledWith("conv-6");
  });
});
