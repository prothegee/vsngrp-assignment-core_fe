<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { DisplayChatMessage } from "../stores/chat";

const { messages, isWaitingForReply = false } = defineProps<{
  messages: DisplayChatMessage[];
  isWaitingForReply?: boolean;
}>();

const scrollContainer = ref<HTMLElement | null>(null);

marked.setOptions({ breaks: true, gfm: true });

watch(
  () => [messages.length, isWaitingForReply],
  async () => {
    await nextTick();
    scrollContainer.value?.scrollTo({ top: scrollContainer.value.scrollHeight });
  },
);

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString();
}

function renderMarkdown(content: string): string {
  const html = marked.parse(content, { async: false });
  return DOMPurify.sanitize(html);
}
</script>

<template>
  <div ref="scrollContainer" class="message-list">
    <p v-if="messages.length === 0" class="empty-hint">No messages yet, say hello.</p>

    <article
      v-for="(message, index) in messages"
      :key="index"
      class="message"
      :class="message.role"
    >
      <!-- eslint-disable-next-line vue/no-v-html -- renderMarkdown always runs the result through DOMPurify.sanitize -->
      <div class="message-content" v-html="renderMarkdown(message.content)"></div>
      <span v-if="message.pending" class="cursor">|</span>
      <time class="message-time">{{ formatTimestamp(message.timestamp) }}</time>
    </article>

    <article v-if="isWaitingForReply" class="message assistant waiting-indicator" aria-live="polite" aria-label="Waiting for a reply">
      <span class="waiting-dot"></span>
      <span class="waiting-dot"></span>
      <span class="waiting-dot"></span>
    </article>
  </div>
</template>

<style scoped>
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.empty-hint {
  color: rgba(128, 128, 128, 0.8);
}

.message {
  max-width: 32rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
}

.message.user {
  align-self: flex-end;
  background: rgba(59, 130, 246, 0.15);
}

.message.assistant {
  align-self: flex-start;
  background: rgba(128, 128, 128, 0.15);
}

.message-content {
  word-break: break-word;
}

.message-content :deep(p) {
  margin: 0 0 0.5rem;
}

.message-content :deep(p:last-child) {
  margin-bottom: 0;
}

.message-content :deep(ul),
.message-content :deep(ol) {
  margin: 0 0 0.5rem 1.25rem;
  padding: 0;
}

.message-content :deep(ul:last-child),
.message-content :deep(ol:last-child) {
  margin-bottom: 0;
}

.message-content :deep(pre) {
  margin: 0 0 0.5rem;
  padding: 0.5rem;
  overflow-x: auto;
  border-radius: 0.25rem;
  background: rgba(0, 0, 0, 0.15);
}

.message-content :deep(code) {
  font-family: monospace;
}

.message-content :deep(a) {
  color: inherit;
}

.message-content :deep(blockquote) {
  margin: 0 0 0.5rem;
  padding-left: 0.75rem;
  border-left: 0.2rem solid rgba(128, 128, 128, 0.4);
}

.cursor {
  animation: blink 1s step-start infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.waiting-indicator {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.75rem;
}

.waiting-dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: rgba(128, 128, 128, 0.7);
  animation: waiting-bounce 1.2s ease-in-out infinite;
}

.waiting-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.waiting-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes waiting-bounce {
  0%,
  60%,
  100% {
    opacity: 0.3;
    transform: translateY(0);
  }

  30% {
    opacity: 1;
    transform: translateY(-0.15rem);
  }
}

.message-time {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: rgba(128, 128, 128, 0.8);
}
</style>
