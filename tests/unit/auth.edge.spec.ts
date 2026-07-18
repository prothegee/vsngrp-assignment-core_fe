import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "../../src/stores/auth";
import { ApiError } from "../../src/services/httpClient";

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("auth store edge cases", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("rejects with invalid_credentials on a wrong password and stays unauthenticated", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(mockResponse(401, { error: "invalid_credentials" }));

    const authStore = useAuthStore();
    const signinAttempt = authStore.signin("person@example.com", "wrong-password");

    await expect(signinAttempt).rejects.toThrow(ApiError);
    await signinAttempt.catch((error: unknown) => {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).body?.error).toBe("invalid_credentials");
    });
    expect(authStore.isAuthenticated).toBe(false);
  });

  it("rejects with email_already_registered on a duplicate signup and stays unauthenticated", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(mockResponse(409, { error: "email_already_registered" }));

    const authStore = useAuthStore();
    const signupAttempt = authStore.signup("taken@example.com", "hunter2");

    await expect(signupAttempt).rejects.toThrow(ApiError);
    await signupAttempt.catch((error: unknown) => {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).body?.error).toBe("email_already_registered");
    });
    expect(authStore.isAuthenticated).toBe(false);
  });

  it("silently refreshes the access token before it expires mid-session", async () => {
    vi.useFakeTimers();

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(mockResponse(200, { accessToken: "short-lived-token", expiresInSeconds: 120 }));
    fetchMock.mockResolvedValueOnce(mockResponse(200, { accessToken: "refreshed-token", expiresInSeconds: 900 }));

    const authStore = useAuthStore();
    await authStore.signin("person@example.com", "hunter2");

    expect(authStore.accessToken).toBe("short-lived-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // a 120s token schedules its silent refresh 60s before expiry, well before the token itself dies
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("/auth/refresh"), expect.anything());
    expect(authStore.accessToken).toBe("refreshed-token");
    expect(authStore.isAuthenticated).toBe(true);
  });

  it("logs the account out if the silent refresh itself fails mid-session", async () => {
    vi.useFakeTimers();

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(mockResponse(200, { accessToken: "short-lived-token", expiresInSeconds: 120 }));
    fetchMock.mockResolvedValueOnce(mockResponse(401, { error: "session_expired" }));

    const authStore = useAuthStore();
    await authStore.signin("person@example.com", "hunter2");

    await vi.advanceTimersByTimeAsync(60_000);

    expect(authStore.isAuthenticated).toBe(false);
    expect(authStore.accessToken).toBeNull();
  });
});
