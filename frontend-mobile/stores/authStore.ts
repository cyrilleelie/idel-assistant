import { create } from 'zustand';
import * as keyManager from '@/security/keyManager';
import { performSecureWipe } from '@/security/secureWipe';
import { api } from '@/services/api';

/** User profile returned by /auth/me */
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  rpps: string | null;
  phone: string | null;
  role: string;
}

/** Cabinet information from /auth/me */
interface Cabinet {
  id: string;
  name: string;
  address: string | null;
  plan: string | null;
}

interface AuthState {
  user: User | null;
  cabinet: Cabinet | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  fetchMe: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  restoreSession: () => Promise<boolean>;
  logout: () => Promise<void>;
  reset: () => void;
}

const initialState: AuthState = {
  user: null,
  cabinet: null,
  isAuthenticated: false,
  isLoading: false,
};

/**
 * Authentication store. Manages user session, tokens, and encryption keys.
 *
 * Tokens are stored in SecureStore (not AsyncStorage) for security.
 * No Zustand persist middleware is used because we never want auth
 * state serialized to plaintext storage.
 */
export const useAuthStore = create<AuthState & AuthActions>()((set, get) => ({
  ...initialState,

  /**
   * Authenticates the user with email/password, stores tokens,
   * fetches the user profile, and generates encryption keys if needed.
   */
  login: async (email: string, password: string): Promise<void> => {
    set({ isLoading: true });
    try {
      const response = await api.post<{
        access_token: string;
        refresh_token: string;
      }>('/auth/login', { email, password });

      const { access_token, refresh_token } = response.data;

      await keyManager.storeToken('access', access_token);
      await keyManager.storeToken('refresh', refresh_token);

      await get().fetchMe();

      // Generate encryption keys on first login if they do not exist
      await keyManager.generateAndStoreKeys();

      // Record activity timestamp for inactivity tracking
      await keyManager.setLastActivity(Date.now());
    } catch (error) {
      set({ ...initialState });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Fetches the current user's profile from /auth/me and populates
   * the user and cabinet fields.
   */
  fetchMe: async (): Promise<void> => {
    const response = await api.get<{
      user: {
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        rpps: string | null;
        phone: string | null;
        role: string;
      };
      cabinet: {
        id: string;
        name: string;
        address: string | null;
        plan: string | null;
      };
    }>('/auth/me');

    const { user: u, cabinet: c } = response.data;
    set({
      user: {
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        rpps: u.rpps,
        phone: u.phone,
        role: u.role,
      },
      cabinet: {
        id: c.id,
        name: c.name,
        address: c.address,
        plan: c.plan,
      },
      isAuthenticated: true,
    });
  },

  /**
   * Attempts to refresh the access token using the stored refresh token.
   * Returns true if successful, false otherwise.
   */
  refreshToken: async (): Promise<boolean> => {
    try {
      const refreshToken = await keyManager.getToken('refresh');
      if (!refreshToken) {
        return false;
      }

      const response = await api.post<{
        access_token: string;
        refresh_token: string;
      }>('/auth/refresh', { refresh_token: refreshToken });

      const { access_token, refresh_token: newRefreshToken } = response.data;

      await keyManager.storeToken('access', access_token);
      await keyManager.storeToken('refresh', newRefreshToken);

      return true;
    } catch {
      return false;
    }
  },

  /**
   * Attempts to restore a session from stored tokens.
   * Returns true if a valid session was restored, false otherwise.
   */
  restoreSession: async (): Promise<boolean> => {
    set({ isLoading: true });
    try {
      const accessToken = await keyManager.getToken('access');
      if (!accessToken) {
        set({ ...initialState });
        return false;
      }

      try {
        await get().fetchMe();
        await keyManager.setLastActivity(Date.now());
        return true;
      } catch {
        // Access token may be expired, try refresh
        const refreshed = await get().refreshToken();
        if (refreshed) {
          try {
            await get().fetchMe();
            await keyManager.setLastActivity(Date.now());
            return true;
          } catch {
            // Refresh succeeded but fetchMe failed
          }
        }
        set({ ...initialState });
        return false;
      }
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Logs out the user by performing a secure wipe of all local data.
   * Resets the store state.
   */
  logout: async (): Promise<void> => {
    await performSecureWipe('user_logout');
    set({ ...initialState });
  },

  /** Resets the store to its initial state without performing a wipe */
  reset: (): void => {
    set({ ...initialState });
  },
}));
