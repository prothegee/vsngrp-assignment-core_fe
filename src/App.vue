<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
import { useAuthStore } from "./stores/auth";

const authStore = useAuthStore();
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <span class="app-title">VissionTech Chat</span>
      <nav class="app-nav">
        <template v-if="authStore.isAuthenticated">
          <RouterLink to="/chat">Chat</RouterLink>
          <RouterLink to="/signout">Sign out</RouterLink>
        </template>
        <template v-else>
          <RouterLink to="/signin">Sign in</RouterLink>
          <RouterLink to="/signup">Sign up</RouterLink>
        </template>
      </nav>
    </header>

    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style>
:root {
  color-scheme: light dark;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(128, 128, 128, 0.3);
}

.app-title {
  font-weight: 600;
}

.app-nav {
  display: flex;
  gap: 1rem;
}

.app-main {
  flex: 1;
  display: flex;
  min-height: 0;
}

@media (max-width: 30rem) {
  .app-header {
    flex-wrap: wrap;
    padding: 0.5rem;
  }

  .app-nav {
    gap: 0.5rem;
  }
}
</style>
