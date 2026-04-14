import { create } from 'zustand';
import { STORAGE_KEYS } from '../utils/constants';
import { getItem, setItem, multiRemove, getJSON, setJSON } from '../utils/storage';
import * as authApi from '../api/auth.api';
import type { BackendUser } from '../api/auth.api';
import { DEMO_USER } from '../data/dummyData';

/**
 * Auth user — mirrors the backend user model's public fields.
 * Field names match the backend exactly (_id, fullName, profilePicture).
 */
export interface AuthUser {
  _id: string;
  username: string;
  email: string;
  fullName: string;
  profilePicture: string;
  bio: string;
  website: string;
  isVerified: boolean;
  isPrivate: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemoMode: boolean;

  /** Restore persisted auth on app launch */
  hydrate: () => Promise<void>;

  /** Login with username/email + password */
  login: (usernameOrEmail: string, password: string) => Promise<void>;

  /** Register a new account */
  register: (payload: authApi.RegisterPayload) => Promise<void>;

  /** Enter demo mode — no backend required */
  enterDemoMode: () => Promise<void>;

  /** Clear auth and persisted tokens */
  logout: () => Promise<void>;

  /** Update cached user object in memory + storage */
  setUser: (user: AuthUser) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  isDemoMode: false,

  hydrate: async () => {
    try {
      const [token, user] = await Promise.all([
        getItem(STORAGE_KEYS.TOKEN),
        getJSON<AuthUser>(STORAGE_KEYS.USER),
      ]);

      if (token && user) {
        set({ token, user, isAuthenticated: true, isLoading: false, isDemoMode: token === 'demo_token' });
      } else {
        // No stored session → auto-enter demo mode so the app is usable without backend
        const demoUser = DEMO_USER as AuthUser;
        await Promise.all([
          setItem(STORAGE_KEYS.TOKEN, 'demo_token'),
          setJSON(STORAGE_KEYS.USER, demoUser),
        ]);
        set({ token: 'demo_token', user: demoUser, isAuthenticated: true, isLoading: false, isDemoMode: true });
      }
    } catch {
      // Storage failure → fall back to demo mode in-memory only
      const demoUser = DEMO_USER as AuthUser;
      set({ token: 'demo_token', user: demoUser, isAuthenticated: true, isLoading: false, isDemoMode: true });
    }
  },

  login: async (usernameOrEmail, password) => {
    const result = await authApi.login({ usernameOrEmail, password });
    const user = result.user as AuthUser;
    const isDemo = result.token === 'demo_token';

    await Promise.all([
      setItem(STORAGE_KEYS.TOKEN, result.token),
      setJSON(STORAGE_KEYS.USER, user),
    ]);

    set({ user, token: result.token, isAuthenticated: true, isDemoMode: isDemo });
  },

  register: async (payload) => {
    const result = await authApi.register(payload);
    const user = result.user as AuthUser;
    const isDemo = result.token === 'demo_token';

    await Promise.all([
      setItem(STORAGE_KEYS.TOKEN, result.token),
      setJSON(STORAGE_KEYS.USER, user),
    ]);

    set({ user, token: result.token, isAuthenticated: true, isDemoMode: isDemo });
  },

  enterDemoMode: async () => {
    const demoUser = DEMO_USER as AuthUser;
    await Promise.all([
      setItem(STORAGE_KEYS.TOKEN, 'demo_token'),
      setJSON(STORAGE_KEYS.USER, demoUser),
    ]);
    set({ token: 'demo_token', user: demoUser, isAuthenticated: true, isDemoMode: true });
  },

  logout: async () => {
    await multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER]);
    set({ user: null, token: null, isAuthenticated: false, isDemoMode: false });
  },

  setUser: (user) => {
    setJSON(STORAGE_KEYS.USER, user).catch(() => {});
    set({ user });
  },
}));
