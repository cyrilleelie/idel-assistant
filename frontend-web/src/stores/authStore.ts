import { create } from "zustand";
import { login as apiLogin, register as apiRegister } from "@/api/auth";
import type { User } from "@/types/models";

function decodeTokenPayload(token: string): Record<string, unknown> {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function buildUserFromToken(
  token: string,
  fallback?: { email?: string; first_name?: string; last_name?: string; rpps?: string }
): User {
  const payload = decodeTokenPayload(token);
  return {
    id: (payload.sub as string) || "",
    email: (payload.email as string) || fallback?.email || "",
    first_name: (payload.first_name as string) || fallback?.first_name || "",
    last_name: (payload.last_name as string) || fallback?.last_name || "",
    rpps: (payload.rpps as string) || fallback?.rpps || "",
    phone: (payload.phone as string) || "",
    cabinet_id: (payload.cabinet_id as string) || "",
    role: (payload.role as string) || "idel",
    created_at: "",
  };
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    rpps: string;
  }) => Promise<void>;
  logout: () => void;
  loadTokens: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    const response = await apiLogin(email, password);
    localStorage.setItem("access_token", response.access_token);
    localStorage.setItem("refresh_token", response.refresh_token);

    const user = buildUserFromToken(response.access_token, { email });

    set({
      user,
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  register: async (payload) => {
    const response = await apiRegister(payload);
    localStorage.setItem("access_token", response.access_token);
    localStorage.setItem("refresh_token", response.refresh_token);

    const user = buildUserFromToken(response.access_token, payload);

    set({
      user,
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  loadTokens: () => {
    try {
      const accessToken = localStorage.getItem("access_token");
      const refreshToken = localStorage.getItem("refresh_token");

      if (accessToken) {
        const user = buildUserFromToken(accessToken);
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
