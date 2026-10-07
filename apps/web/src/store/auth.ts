import { create } from "zustand";
import type { User } from "@workspace/api-client-react";
import { apiFetch, getStoredRefreshToken, getStoredToken, clearStoredToken, setStoredToken, setStoredRefreshToken } from "@/lib/api";

export type AuthUser = User & {
  role?: string;
  postsCount?: number;
  followingCount?: number;
  headline?: string | null;
  identityType?: string | null;
};

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  token: string | null;
  setAuth: (user: AuthUser, token: string) => void;
  setUser: (user: AuthUser | null) => void;
  setInitializing: (v: boolean) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isInitializing: true,
  token: getStoredToken(),

  setAuth: (user, token) => {
    if (!user) {
      clearStoredToken();
      set({ user: null, token: null, isAuthenticated: false });
      return;
    }
    set({ user, token, isAuthenticated: true });
  },

  setUser: (user) => {
    set({ user, isAuthenticated: !!user });
  },

  setInitializing: (v) => set({ isInitializing: v }),

  logout: () => {
    clearStoredToken();
    set({ user: null, token: null, isAuthenticated: false });
  },

  refreshUser: async () => {
    const token = get().token ?? getStoredToken();
    if (!token) {
      set({ user: null, isAuthenticated: false });
      return;
    }
    try {
      const res = await apiFetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status !== 401) throw new Error(`Session check failed (${res.status})`);
        const refreshToken = getStoredRefreshToken();
        if (refreshToken) {
          const refreshRes = await apiFetch("/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });
          if (!refreshRes.ok && refreshRes.status !== 401) {
            throw new Error(`Session refresh failed (${refreshRes.status})`);
          }
          if (refreshRes.ok) {
            const refreshed = await refreshRes.json();
            setStoredToken(refreshed.token);
            setStoredRefreshToken(refreshed.refreshToken);
            set({ token: refreshed.token });
            const retry = await apiFetch("/api/auth/me", {
              headers: { Authorization: `Bearer ${refreshed.token}` },
            });
            if (!retry.ok && retry.status !== 401) {
              throw new Error(`Refreshed session check failed (${retry.status})`);
            }
            if (retry.ok) {
              const user: AuthUser = await retry.json();
              if (!user) {
                clearStoredToken();
                set({ user: null, token: null, isAuthenticated: false });
                return;
              }
              set({ user, isAuthenticated: true, token: refreshed.token });
              return;
            }
          }
        }
        clearStoredToken();
        set({ user: null, token: null, isAuthenticated: false });
        return;
      }
      const user: AuthUser = await res.json();
      if (!user) {
        clearStoredToken();
        set({ user: null, token: null, isAuthenticated: false });
        return;
      }
      set({ user, isAuthenticated: true, token });
    } catch (error) {
      console.warn("[auth] Session check unavailable; keeping stored credentials for retry", error);
      set({ user: null, token: getStoredToken(), isAuthenticated: false });
    }
  },
}));
