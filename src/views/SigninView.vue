<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { ApiError } from "../services/httpClient";

const email = ref("");
const password = ref("");
const errorMessage = ref("");
const isSubmitting = ref(false);

const authStore = useAuthStore();
const router = useRouter();

const errorMessages: Record<string, string> = {
  invalid_credentials: "Incorrect email or password.",
};

async function handleSubmit(): Promise<void> {
  errorMessage.value = "";
  isSubmitting.value = true;

  try {
    await authStore.signin(email.value, password.value);
    await router.push("/chat");
  } catch (error) {
    const code = error instanceof ApiError ? error.body?.error : undefined;
    errorMessage.value = (code && errorMessages[code]) ?? "Sign in failed, please try again.";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <section class="auth-card">
    <h1>Sign in</h1>

    <form @submit.prevent="handleSubmit">
      <label for="signin-email">Email</label>
      <input id="signin-email" v-model="email" type="email" autocomplete="email" />

      <label for="signin-password">Password</label>
      <input id="signin-password" v-model="password" type="password" autocomplete="current-password" />

      <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>

      <button type="submit" :disabled="isSubmitting">Sign in</button>
    </form>

    <p class="auth-switch">No account yet? <RouterLink to="/signup">Sign up</RouterLink></p>
  </section>
</template>

<style scoped>
.auth-card {
  width: 100%;
  max-width: 24rem;
  margin: 2rem auto;
  padding: 1.5rem;
}

form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

input {
  padding: 0.5rem;
  font-size: 1rem;
}

button {
  margin-top: 0.5rem;
  padding: 0.6rem;
  font-size: 1rem;
  cursor: pointer;
}

.auth-error {
  color: #d33;
  margin: 0;
}

.auth-switch {
  margin-top: 1rem;
  text-align: center;
}
</style>
