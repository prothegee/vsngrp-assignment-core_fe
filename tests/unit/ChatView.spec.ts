import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
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

const { default: ChatView } = await import("../../src/views/ChatView.vue");

describe("ChatView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    messageHandler = null;
    statusHandler = null;
  });

  function mountWithOneConversation(): VueWrapper {
    const wrapper = mount(ChatView);

    statusHandler?.("open");
    messageHandler?.({
      type: "conversation_list",
      conversations: [{ id: "conv-1", accountId: "acc-1", title: "Test 1", createdAt: "2026-01-01T00:00:00Z" }],
    });

    return wrapper;
  }

  it("shows a fallback in the thread header when no conversation is active", () => {
    const wrapper = mount(ChatView);

    expect(wrapper.find(".active-conversation-title").text()).toBe("No conversation selected");
  });

  it("shows the active conversation's title in the thread header once selected", async () => {
    const wrapper = mountWithOneConversation();
    await wrapper.vm.$nextTick();

    await wrapper.find(".conversation-title").trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".active-conversation-title").text()).toBe("Test 1");
  });

  it("re-shows the thread when the already-active conversation is re-selected after Back", async () => {
    const wrapper = mountWithOneConversation();
    await wrapper.vm.$nextTick();

    await wrapper.find(".conversation-title").trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".chat-view").classes()).toContain("thread-active");

    await wrapper.find(".back-to-list").trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".chat-view").classes()).not.toContain("thread-active");

    await wrapper.find(".conversation-title").trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".chat-view").classes()).toContain("thread-active");
  });

  it("shows a waiting indicator right after sending, and hands off to the streamed reply once it starts", async () => {
    const wrapper = mountWithOneConversation();
    await wrapper.vm.$nextTick();

    await wrapper.find(".conversation-title").trigger("click");
    await wrapper.vm.$nextTick();

    await wrapper.find("textarea").setValue("Hello there");
    await wrapper.find("form.chat-input").trigger("submit");
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".waiting-indicator").exists()).toBe(true);

    messageHandler?.({ type: "message_chunk", conversationId: "conv-1", delta: "Hi" });
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".waiting-indicator").exists()).toBe(false);
    expect(wrapper.find(".cursor").exists()).toBe(true);

    messageHandler?.({
      type: "message_complete",
      conversationId: "conv-1",
      message: { role: "assistant", content: "Hi there", timestamp: "2026-01-01T00:00:01Z" },
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".waiting-indicator").exists()).toBe(false);
    expect(wrapper.find(".cursor").exists()).toBe(false);
  });
});
