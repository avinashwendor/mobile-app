import { create } from 'zustand';
import { STORAGE_KEYS } from '../utils/constants';
import { getItem, setItem, multiRemove, getJSON, setJSON } from '../utils/storage';
import * as authApi from '../api/auth.api';
import type { MobileUser } from '../api/adapters';
import { unregisterStoredPushToken } from '../services/pushNotificationService';

/**
 * Authentication store.
 *
 * Persists `{ token, refreshToken, user }` in AsyncStorage so the session
 * survives app restarts. No dummy/demo fallback: if the backend is
 * unreachable, the app surfaces a clear error rather than pretending to be
 * logged in.
 */

export type AuthUser = MobileUser;

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  /** Restore persisted auth on app launch */
  hydrate: () => Promise<void>;

  /** Login with username/email + password */
  login: (usernameOrEmail: string, password: string) => Promise<void>;

  /** Register a new account */
  register: (payload: authApi.RegisterPayload) => Promise<void>;

  /** Refetch the current user (e.g. after profile edit) */
  refresh: () => Promise<void>;

  /** Clear auth and persisted tokens */
  logout: () => Promise<void>;

  /** Update cached user object in memory + storage */
  setUser: (user: AuthUser) => void;
}

const persistSession = async (user: AuthUser, token: string, refreshToken: string) => {
  await Promise.all([
    setItem(STORAGE_KEYS.TOKEN, token),
    setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
    setJSON(STORAGE_KEYS.USER, user),
  ]);
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  hydrate: async () => {
    try {
      const [token, refreshToken, user] = await Promise.all([
        getItem(STORAGE_KEYS.TOKEN),
        getItem(STORAGE_KEYS.REFRESH_TOKEN),
        getJSON<AuthUser>(STORAGE_KEYS.USER),
      ]);

      if (token && user) {
        set({ token, refreshToken, user, isAuthenticated: true, isLoading: false });
        // Revalidate in the background — if it fails with 401 the client
        // interceptor will clear the session and the UI will redirect.
        authApi.getMe().then((fresh) => {
          setJSON(STORAGE_KEYS.USER, fresh).catch(() => {});
          set({ user: fresh });
        }).catch(async () => {
          // Persisted auth can become stale after backend resets/deploys.
          // In that case, drop local session so UI returns to login cleanly.
          await multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.REFRESH_TOKEN, STORAGE_KEYS.USER]);
          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
          });
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  login: async (usernameOrEmail, password) => {
    const result = await authApi.login({ usernameOrEmail, password });
    await persistSession(result.user, result.token, result.refreshToken);
    set({
      user: result.user,
      token: result.token,
      refreshToken: result.refreshToken,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  register: async (payload) => {
    const result = await authApi.register(payload);
    await persistSession(result.user, result.token, result.refreshToken);
    set({
      user: result.user,
      token: result.token,
      refreshToken: result.refreshToken,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  refresh: async () => {
    const fresh = await authApi.getMe();
    await setJSON(STORAGE_KEYS.USER, fresh);
    set({ user: fresh });
  },

  logout: async () => {
    const { refreshToken } = get();
    await unregisterStoredPushToken().catch(() => {});
    if (refreshToken) {
      authApi.logout(refreshToken).catch(() => {});
    }
    await multiRemove([
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.PUSH_TOKEN,
      STORAGE_KEYS.USER,
    ]);
    set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
  },

  setUser: (user) => {
    setJSON(STORAGE_KEYS.USER, user).catch(() => {});
    set({ user });
  },
}));
