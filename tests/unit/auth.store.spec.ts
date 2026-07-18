import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "../../src/stores/auth";

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("auth store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("signup stores the access token and marks the account as authenticated", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(mockResponse(200, { accessToken: "token-a", expiresInSeconds: 900 }));

    const authStore = useAuthStore();
    await authStore.signup("person@example.com", "hunter2");

    expect(authStore.isAuthenticated).toBe(true);
    expect(authStore.accessToken).toBe("token-a");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/signup"),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("signin stores the access token and marks the account as authenticated", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(mockResponse(200, { accessToken: "token-b", expiresInSeconds: 900 }));

    const authStore = useAuthStore();
    await authStore.signin("person@example.com", "hunter2");

    expect(authStore.isAuthenticated).toBe(true);
    expect(authStore.accessToken).toBe("token-b");
  });

  it("signout clears the session locally even though the server call is best-effort", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(mockResponse(200, { accessToken: "token-c", expiresInSeconds: 900 }));
    fetchMock.mockResolvedValueOnce(mockResponse(204, undefined));

    const authStore = useAuthStore();
    await authStore.signin("person@example.com", "hunter2");
    await authStore.signout();

    expect(authStore.isAuthenticated).toBe(false);
    expect(authStore.accessToken).toBeNull();
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/auth/signout"),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token-c" }) }),
    );
  });

  it("signout clears the session locally even if the server call fails", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(mockResponse(200, { accessToken: "token-d", expiresInSeconds: 900 }));
    fetchMock.mockRejectedValueOnce(new TypeError("network error"));

    const authStore = useAuthStore();
    await authStore.signin("person@example.com", "hunter2");
    await authStore.signout();

    expect(authStore.isAuthenticated).toBe(false);
  });

  it("ensureBootstrapped only calls refresh once even when invoked concurrently", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(mockResponse(401, { error: "missing_refresh_token" }));

    const authStore = useAuthStore();
    await Promise.all([authStore.ensureBootstrapped(), authStore.ensureBootstrapped()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(authStore.isAuthenticated).toBe(false);
  });
});
