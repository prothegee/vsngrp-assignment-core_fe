import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { apiRequest, ApiError } from "../services/httpClient";

interface AuthResponseBody {
  accessToken: string;
  expiresInSeconds: number;
}

const refreshMarginSeconds = 60;

export const useAuthStore = defineStore("auth", () => {
  const accessToken = ref<string | null>(null);
  const expiresAt = ref<number | null>(null);
  const bootstrapPromise = ref<Promise<void> | null>(null);
  let refreshTimeoutId: ReturnType<typeof setTimeout> | null = null;

  const isAuthenticated = computed(() => accessToken.value !== null);

  function clearRefreshTimer(): void {
    if (refreshTimeoutId === null) {
      return;
    }

    clearTimeout(refreshTimeoutId);
    refreshTimeoutId = null;
  }

  function scheduleRefresh(expiresInSeconds: number): void {
    clearRefreshTimer();

    const delaySeconds =
      expiresInSeconds > refreshMarginSeconds
        ? expiresInSeconds - refreshMarginSeconds
        : Math.max(1, Math.floor(expiresInSeconds / 2));

    refreshTimeoutId = setTimeout(() => {
      void refresh();
    }, delaySeconds * 1000);
  }

  function setSession(body: AuthResponseBody): void {
    accessToken.value = body.accessToken;
    expiresAt.value = Date.now() + body.expiresInSeconds * 1000;

    scheduleRefresh(body.expiresInSeconds);
  }

  function clearSession(): void {
    accessToken.value = null;
    expiresAt.value = null;

    clearRefreshTimer();
  }

  async function signup(email: string, password: string): Promise<void> {
    const body = await apiRequest<AuthResponseBody>({
      method: "POST",
      path: "/auth/signup",
      body: { email, password },
    });

    setSession(body);
  }

  async function signin(email: string, password: string): Promise<void> {
    const body = await apiRequest<AuthResponseBody>({
      method: "POST",
      path: "/auth/signin",
      body: { email, password },
    });

    setSession(body);
  }

  async function signout(): Promise<void> {
    const tokenBeingClosed = accessToken.value;
    clearSession();

    if (tokenBeingClosed === null) {
      return;
    }

    try {
      await apiRequest<void>({ method: "POST", path: "/auth/signout", accessToken: tokenBeingClosed });
    } catch {
      // best-effort, the session is already cleared client-side regardless of the server outcome
    }
  }

  async function refresh(): Promise<boolean> {
    try {
      const body = await apiRequest<AuthResponseBody>({ method: "POST", path: "/auth/refresh" });
      setSession(body);

      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        clearSession();
      }

      return false;
    }
  }

  function ensureBootstrapped(): Promise<void> {
    if (bootstrapPromise.value === null) {
      bootstrapPromise.value = refresh().then(() => undefined);
    }

    return bootstrapPromise.value;
  }

  return {
    accessToken,
    isAuthenticated,
    signup,
    signin,
    signout,
    refresh,
    ensureBootstrapped,
  };
});
