<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useChatStore } from "../stores/chat";
import ConversationList from "../components/ConversationList.vue";
import ChatMessageList from "../components/ChatMessageList.vue";
import ChatInput from "../components/ChatInput.vue";

const chatStore = useChatStore();
const inputErrorMessage = ref("");
const isMobileThreadVisible = ref(false);

watch(
  () => chatStore.activeConversationId,
  (activeConversationId) => {
    if (activeConversationId !== null) {
      isMobileThreadVisible.value = true;
    }
  },
);

const activeMessages = computed(() => {
  const conversationId = chatStore.activeConversationId;
  if (conversationId === null) {
    return [];
  }

  return chatStore.messagesByConversation[conversationId] ?? [];
});

const activeConversationTitle = computed(() => {
  const conversationId = chatStore.activeConversationId;
  if (conversationId === null) {
    return null;
  }

  return chatStore.conversations.find((conversation) => conversation.id === conversationId)?.title ?? null;
});

const isWaitingForReply = computed(() => {
  if (!chatStore.isSending) {
    return false;
  }

  const lastMessage = activeMessages.value[activeMessages.value.length - 1];
  return !(lastMessage?.role === "assistant" && lastMessage.pending);
});

const statusLabel = computed(() => {
  switch (chatStore.connectionStatus) {
    case "open":
      return "Connected";
    case "connecting":
      return "Connecting...";
    case "closed":
      return "Disconnected, reconnecting...";
  }

  return "";
});

function handleSelectConversation(conversationId: string): void {
  chatStore.selectConversation(conversationId);
  isMobileThreadVisible.value = true;
}

function handleSend(content: string): void {
  inputErrorMessage.value = "";

  const result = chatStore.sendMessage(content);
  if (result === "too_large") {
    inputErrorMessage.value = "That message is too large to send.";
  } else if (result === "no_active_conversation") {
    inputErrorMessage.value = "Create or select a conversation first.";
  }
}

onMounted(() => {
  chatStore.connect();
});

onUnmounted(() => {
  chatStore.disconnect();
});
</script>

<template>
  <div class="chat-view" :class="{ 'thread-active': isMobileThreadVisible }">
    <ConversationList
      class="chat-view-list"
      :conversations="chatStore.conversations"
      :active-conversation-id="chatStore.activeConversationId"
      @create="chatStore.createConversation"
      @select="handleSelectConversation"
      @rename="chatStore.renameConversation"
      @delete="chatStore.deleteConversation"
    />

    <section class="chat-thread">
      <div class="chat-thread-header">
        <button type="button" class="back-to-list" @click="isMobileThreadVisible = false">Back</button>
        <p class="active-conversation-title">{{ activeConversationTitle ?? "No conversation selected" }}</p>
        <p class="connection-status" :class="chatStore.connectionStatus">{{ statusLabel }}</p>
      </div>

      <ChatMessageList :messages="activeMessages" :is-waiting-for-reply="isWaitingForReply" />

      <p v-if="inputErrorMessage" class="input-error">{{ inputErrorMessage }}</p>
      <p v-else-if="chatStore.lastError" class="input-error">{{ chatStore.lastError }}</p>

      <ChatInput :disabled="chatStore.isSending" @send="handleSend" />
    </section>
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  width: 100%;
  min-height: 0;
}

.chat-view .chat-view-list {
  width: 18rem;
  flex-shrink: 0;
}

.chat-thread {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-thread-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid rgba(128, 128, 128, 0.3);
}

.back-to-list {
  display: none;
}

.active-conversation-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 0.25rem 0;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.connection-status {
  margin: 0;
  padding: 0.25rem 0.75rem;
  font-size: 0.8rem;
  color: rgba(128, 128, 128, 0.9);
}

.connection-status.open {
  color: #2a2;
}

.connection-status.closed {
  color: #d33;
}

.input-error {
  margin: 0;
  padding: 0 0.75rem;
  color: #d33;
}

@media (max-width: 40rem) {
  .chat-view {
    flex-direction: column;
  }

  .chat-view .chat-view-list {
    width: 100%;
  }

  .chat-view:not(.thread-active) .chat-thread {
    display: none;
  }

  .chat-view.thread-active .chat-view-list {
    display: none;
  }

  .chat-view.thread-active .back-to-list {
    display: inline-block;
  }
}
</style>
