<script setup lang="ts">
import { ref } from "vue";
import type { Conversation } from "../services/wsClient";

const { conversations, activeConversationId } = defineProps<{
  conversations: Conversation[];
  activeConversationId: string | null;
}>();

const emit = defineEmits<{
  create: [title: string];
  select: [conversationId: string];
  rename: [conversationId: string, title: string];
  delete: [conversationId: string];
}>();

const newConversationTitle = ref("");
const renamingConversationId = ref<string | null>(null);
const renameDraft = ref("");

function handleCreate(): void {
  if (newConversationTitle.value.trim() === "") {
    return;
  }

  emit("create", newConversationTitle.value);
  newConversationTitle.value = "";
}

function startRename(conversation: Conversation): void {
  renamingConversationId.value = conversation.id;
  renameDraft.value = conversation.title;
}

function confirmRename(conversationId: string): void {
  emit("rename", conversationId, renameDraft.value);
  renamingConversationId.value = null;
}

function cancelRename(): void {
  renamingConversationId.value = null;
}
</script>

<template>
  <aside class="conversation-list">
    <form class="conversation-create" @submit.prevent="handleCreate">
      <input v-model="newConversationTitle" type="text" placeholder="New conversation title" />
      <button type="submit">Create</button>
    </form>

    <ul>
      <li
        v-for="conversation in conversations"
        :key="conversation.id"
        :class="{ active: conversation.id === activeConversationId }"
      >
        <template v-if="renamingConversationId === conversation.id">
          <input v-model="renameDraft" type="text" @keyup.enter="confirmRename(conversation.id)" />
          <button type="button" @click="confirmRename(conversation.id)">Save</button>
          <button type="button" @click="cancelRename">Cancel</button>
        </template>
        <template v-else>
          <button type="button" class="conversation-title" @click="emit('select', conversation.id)">
            {{ conversation.title }}
          </button>
          <button type="button" title="Rename" @click="startRename(conversation)">Rename</button>
          <button type="button" title="Delete" @click="emit('delete', conversation.id)">Delete</button>
        </template>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.conversation-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  border-right: 1px solid rgba(128, 128, 128, 0.3);
  padding: 0.75rem;
  overflow-y: auto;
}

.conversation-create {
  display: flex;
  gap: 0.25rem;
}

.conversation-create input {
  flex: 1;
  min-width: 0;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

li {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

li.active .conversation-title {
  font-weight: 700;
}

.conversation-title {
  flex: 1;
  min-width: 0;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
