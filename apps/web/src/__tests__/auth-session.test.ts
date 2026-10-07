import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  clearStoredToken: vi.fn(),
  getStoredRefreshToken: vi.fn((): string | null => "refresh-token"),
  getStoredToken: vi.fn(() => "access-token"),
  setStoredRefreshToken: vi.fn(),
  setStoredToken: vi.fn(),
}));

vi.mock("@/lib/api", () => authMocks);

import { useAuthStore } from "@/store/auth";

describe("auth session persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getStoredToken.mockReturnValue("access-token");
    authMocks.getStoredRefreshToken.mockReturnValue("refresh-token");
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isInitializing: false,
      token: "access-token",
    });
  });

  it("keeps stored credentials when session validation is temporarily unavailable", async () => {
    authMocks.apiFetch.mockRejectedValue(new TypeError("Network unavailable"));

    await useAuthStore.getState().refreshUser();

    expect(authMocks.clearStoredToken).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      token: "access-token",
    });
  });

  it("clears credentials when the access token is rejected and no refresh token exists", async () => {
    authMocks.getStoredRefreshToken.mockReturnValue(null);
    authMocks.apiFetch.mockResolvedValue(new Response(null, { status: 401 }));

    await useAuthStore.getState().refreshUser();

    expect(authMocks.clearStoredToken).toHaveBeenCalledOnce();
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      token: null,
    });
  });
});
