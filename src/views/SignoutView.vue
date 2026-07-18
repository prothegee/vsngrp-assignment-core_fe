<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { useAuthStore } from "../stores/auth";

const authStore = useAuthStore();
const isDone = ref(false);

onMounted(async () => {
  await authStore.signout();
  isDone.value = true;
});
</script>

<template>
  <section class="signout-card">
    <p v-if="!isDone">Signing out...</p>
    <template v-else>
      <h1>Signed out</h1>
      <p>You have been signed out. <RouterLink to="/signin">Sign in again</RouterLink></p>
    </template>
  </section>
</template>

<style scoped>
.signout-card {
  width: 100%;
  max-width: 24rem;
  margin: 2rem auto;
  padding: 1.5rem;
  text-align: center;
}
</style>
