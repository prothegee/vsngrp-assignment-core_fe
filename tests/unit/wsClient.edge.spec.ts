import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ChatWsClient, maxMessageContentBytes } from "../../src/services/wsClient";
import { useChatStore } from "../../src/stores/chat";

class MockWebSocket {
  static readonly OPEN = 1;
  static instances: MockWebSocket[] = [];

  readyState = 0;
  readonly url: string;
  readonly sentMessages: string[] = [];
  private readonly listeners: Record<string, Array<(event: unknown) => void>> = {};

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  addEventListener(eventName: string, handler: (event: unknown) => void): void {
    (this.listeners[eventName] ??= []).push(handler);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.dispatch("close", {});
  }

  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.dispatch("open", {});
  }

  private dispatch(eventName: string, event: unknown): void {
    for (const handler of this.listeners[eventName] ?? []) {
      handler(event);
    }
  }
}

describe("ChatWsClient reconnect behavior", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("sends an auth frame as soon as the socket opens", () => {
    const client = new ChatWsClient(() => "a-token");
    client.connect();

    const socket = MockWebSocket.instances[0];
    socket.simulateOpen();

    expect(socket.sentMessages).toHaveLength(1);
    expect(JSON.parse(socket.sentMessages[0])).toEqual({ type: "auth", token: "a-token" });
  });

  it("reconnects and re-authenticates after the socket closes unexpectedly", async () => {
    const client = new ChatWsClient(() => "a-token");
    client.connect();

    MockWebSocket.instances[0].simulateOpen();
    MockWebSocket.instances[0].close();

    await vi.advanceTimersByTimeAsync(1000);

    expect(MockWebSocket.instances).toHaveLength(2);

    MockWebSocket.instances[1].simulateOpen();
    expect(JSON.parse(MockWebSocket.instances[1].sentMessages[0])).toEqual({ type: "auth", token: "a-token" });
  });

  it("does not reconnect after an explicit disconnect", async () => {
    const client = new ChatWsClient(() => "a-token");
    client.connect();

    MockWebSocket.instances[0].simulateOpen();
    client.disconnect();
    MockWebSocket.instances[0].close();

    await vi.advanceTimersByTimeAsync(10_000);

    expect(MockWebSocket.instances).toHaveLength(1);
  });
});

describe("chat input edge cases", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("refuses to send an empty message", () => {
    const chatStore = useChatStore();
    chatStore.activeConversationId = "conv-1";

    expect(chatStore.sendMessage("   ")).toBe("empty");
  });

  it("refuses to send when there is no active conversation", () => {
    const chatStore = useChatStore();

    expect(chatStore.sendMessage("hello")).toBe("no_active_conversation");
  });

  it("refuses to send a message larger than the server's per-frame cap", () => {
    const chatStore = useChatStore();
    chatStore.activeConversationId = "conv-1";

    const oversizedContent = "x".repeat(maxMessageContentBytes + 1);

    expect(chatStore.sendMessage(oversizedContent)).toBe("too_large");
  });

  it("accepts a normal message within the size cap", () => {
    const chatStore = useChatStore();
    chatStore.activeConversationId = "conv-1";

    expect(chatStore.sendMessage("a reasonably sized message")).toBe("sent");
  });
});
