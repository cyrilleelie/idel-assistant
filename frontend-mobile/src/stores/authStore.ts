import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { login as apiLogin, register as apiRegister } from '../api/auth';
import type { User } from '../types/models';

function decodeTokenPayload(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return {};
  }
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
  logout: () => Promise<void>;
  loadTokens: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    const response = await apiLogin(email, password);
    await SecureStore.setItemAsync('access_token', response.access_token);
    await SecureStore.setItemAsync('refresh_token', response.refresh_token);

    const payload = decodeTokenPayload(response.access_token);
    const user: User = {
      id: (payload.sub as string) || '',
      email: (payload.email as string) || email,
      first_name: (payload.first_name as string) || '',
      last_name: (payload.last_name as string) || '',
      rpps: (payload.rpps as string) || '',
      phone: (payload.phone as string) || '',
      cabinet_id: (payload.cabinet_id as string) || '',
      role: (payload.role as string) || 'idel',
      created_at: '',
    };

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
    await SecureStore.setItemAsync('access_token', response.access_token);
    await SecureStore.setItemAsync('refresh_token', response.refresh_token);

    const tokenPayload = decodeTokenPayload(response.access_token);
    const user: User = {
      id: (tokenPayload.sub as string) || '',
      email: (tokenPayload.email as string) || payload.email,
      first_name: (tokenPayload.first_name as string) || payload.first_name,
      last_name: (tokenPayload.last_name as string) || payload.last_name,
      rpps: (tokenPayload.rpps as string) || payload.rpps,
      phone: '',
      cabinet_id: (tokenPayload.cabinet_id as string) || '',
      role: (tokenPayload.role as string) || 'idel',
      created_at: '',
    };

    set({
      user,
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  loadTokens: async () => {
    try {
      const accessToken = await SecureStore.getItemAsync('access_token');
      const refreshToken = await SecureStore.getItemAsync('refresh_token');

      if (accessToken) {
        const payload = decodeTokenPayload(accessToken);
        const user: User = {
          id: (payload.sub as string) || '',
          email: (payload.email as string) || '',
          first_name: (payload.first_name as string) || '',
          last_name: (payload.last_name as string) || '',
          rpps: (payload.rpps as string) || '',
          phone: (payload.phone as string) || '',
          cabinet_id: (payload.cabinet_id as string) || '',
          role: (payload.role as string) || 'idel',
          created_at: '',
        };

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
