import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ChatMessageList from "../../src/components/ChatMessageList.vue";

describe("ChatMessageList", () => {
  it("does not show the waiting indicator by default", () => {
    const wrapper = mount(ChatMessageList, {
      props: { messages: [] },
    });

    expect(wrapper.find(".waiting-indicator").exists()).toBe(false);
  });

  it("shows the waiting indicator when isWaitingForReply is true", () => {
    const wrapper = mount(ChatMessageList, {
      props: {
        messages: [{ role: "user", content: "Hello", timestamp: "2026-01-01T00:00:00Z" }],
        isWaitingForReply: true,
      },
    });

    expect(wrapper.find(".waiting-indicator").exists()).toBe(true);
  });

  it("hides the waiting indicator once a pending assistant message exists", () => {
    const wrapper = mount(ChatMessageList, {
      props: {
        messages: [
          { role: "user", content: "Hello", timestamp: "2026-01-01T00:00:00Z" },
          { role: "assistant", content: "Hi", timestamp: "2026-01-01T00:00:01Z", pending: true },
        ],
        isWaitingForReply: false,
      },
    });

    expect(wrapper.find(".waiting-indicator").exists()).toBe(false);
    expect(wrapper.find(".cursor").exists()).toBe(true);
  });

  it("renders markdown formatting in message content", () => {
    const wrapper = mount(ChatMessageList, {
      props: {
        messages: [
          {
            role: "assistant",
            content: "**bold** and a list:\n- one\n- two",
            timestamp: "2026-01-01T00:00:00Z",
          },
        ],
      },
    });

    const content = wrapper.find(".message-content");
    expect(content.find("strong").text()).toBe("bold");
    expect(content.findAll("li")).toHaveLength(2);
  });

  it("sanitizes markdown content before rendering it as HTML", () => {
    const wrapper = mount(ChatMessageList, {
      props: {
        messages: [
          {
            role: "assistant",
            content: '<img src="x" onerror="window.__pwned = true">',
            timestamp: "2026-01-01T00:00:00Z",
          },
        ],
      },
    });

    const content = wrapper.find(".message-content");
    expect(content.html()).not.toContain("onerror");
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });
});
