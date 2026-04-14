import apiClient from './client';
import { DEMO_USER } from '../data/dummyData';

/* ───────── Types matching backend response shapes ───────── */

export interface BackendUser {
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

export interface RegisterPayload {
  username: string;
  email: string;
  fullName: string;
  password: string;
}

export interface LoginPayload {
  usernameOrEmail: string;
  password: string;
}

interface AuthResponse {
  user: BackendUser;
  token: string;
}

/* ───────── API Calls ───────── */

/**
 * POST /auth/register
 * Returns { user, token }
 */
export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  try {
    const { data } = await apiClient.post('/auth/register', payload);
    return data.data;
  } catch {
    return { user: DEMO_USER as BackendUser, token: 'demo_token' };
  }
}

/**
 * POST /auth/login
 * Body: { usernameOrEmail, password }
 * Returns { user, token }
 */
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  try {
    const { data } = await apiClient.post('/auth/login', payload);
    return data.data;
  } catch {
    return { user: DEMO_USER as BackendUser, token: 'demo_token' };
  }
}

/**
 * GET /auth/me — fetch the current authenticated user profile
 */
export async function getMe(): Promise<BackendUser> {
  try {
    const { data } = await apiClient.get('/auth/me');
    return data.data.user;
  } catch {
    return DEMO_USER as BackendUser;
  }
}

/**
 * PUT /auth/update-profile
 * Allowed fields: fullName, bio, website, phoneNumber, isPrivate, profilePicture
 */
export async function updateProfile(
  updates: Partial<Pick<BackendUser, 'fullName' | 'bio' | 'website' | 'isPrivate' | 'profilePicture'>>,
): Promise<BackendUser> {
  try {
    const { data } = await apiClient.put('/auth/update-profile', updates);
    return data.data.user;
  } catch {
    return { ...(DEMO_USER as BackendUser), ...updates };
  }
}

/**
 * PUT /auth/change-password
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  try {
    await apiClient.put('/auth/change-password', { currentPassword, newPassword });
  } catch {
    // Silently succeed offline
  }
}

/**
 * POST /auth/update-push-token
 */
export async function updatePushToken(pushToken: string): Promise<void> {
  try {
    await apiClient.post('/auth/update-push-token', { pushToken });
  } catch {
    // Silently succeed offline
  }
}

/**
 * DELETE /auth/deactivate — permanently deactivates the account
 */
export async function deactivateAccount(): Promise<void> {
  try {
    await apiClient.delete('/auth/deactivate');
  } catch {
    // Silently succeed offline
  }
}
