<script setup lang="ts">
import { ref } from "vue";

const { disabled = false } = defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  send: [content: string];
}>();

const draft = ref("");

function handleSend(): void {
  if (draft.value.trim() === "") {
    return;
  }

  emit("send", draft.value);
  draft.value = "";
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
}
</script>

<template>
  <form class="chat-input" @submit.prevent="handleSend">
    <textarea
      v-model="draft"
      rows="2"
      placeholder="Type a message, Enter to send, Shift+Enter for a new line"
      :disabled="disabled"
      @keydown="handleKeydown"
    ></textarea>
    <button type="submit" :disabled="disabled">Send</button>
  </form>
</template>

<style scoped>
.chat-input {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  border-top: 1px solid rgba(128, 128, 128, 0.3);
}

textarea {
  flex: 1;
  resize: none;
  padding: 0.5rem;
  font: inherit;
}

button {
  padding: 0 1rem;
  cursor: pointer;
}
</style>
