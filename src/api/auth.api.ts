import apiClient from './client';
import { mapUser, unwrap, type MobileUser } from './adapters';

/**
 * Auth API — wraps the backend's `/auth` and `/users/me` endpoints and
 * returns the `MobileUser` shape consumed by the rest of the app.
 *
 * Token lifecycle is handled in `authStore`. Everything here is a thin
 * HTTP wrapper that throws a typed `ApiError` on failure.
 */

export interface RegisterPayload {
  username: string;
  email: string;
  fullName: string;
  password: string;
  dateOfBirth?: string;
}

export interface LoginPayload {
  usernameOrEmail: string;
  password: string;
}

export interface AuthResult {
  user: MobileUser;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

/** Build a valid ISO date-of-birth (defaults to 18+ years ago if not provided). */
const resolveDateOfBirth = (input?: string): string => {
  if (input) return input;
  const d = new Date();
  d.setFullYear(d.getFullYear() - 20);
  return d.toISOString().slice(0, 10);
};

/**
 * POST /auth/register — creates the account and returns tokens.
 * The backend login/register response only includes `{id, username, email}`,
 * so we immediately hydrate the full profile via `GET /users/me`.
 */
export async function register(payload: RegisterPayload): Promise<AuthResult> {
  const res = await apiClient.post('/auth/register', {
    email: payload.email.trim().toLowerCase(),
    username: payload.username.trim().toLowerCase(),
    display_name: payload.fullName.trim(),
    password: payload.password,
    date_of_birth: resolveDateOfBirth(payload.dateOfBirth),
  });
  const data = unwrap<any>(res);
  const accessToken = data.access_token;
  const me = await apiClient.get('/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return {
    user: mapUser(unwrap<any>(me)),
    token: accessToken,
    refreshToken: data.refresh_token,
    expiresIn: Number(data.expires_in ?? 0),
  };
}

/**
 * POST /auth/login — backend expects `{ email, password }` only.
 * The login form accepts either a username or email, so if the value does
 * not contain an `@` we treat it as a username and resolve it to an email
 * via a secondary lookup.
 */
export async function login(payload: LoginPayload): Promise<AuthResult> {
  const identifier = payload.usernameOrEmail.trim();
  let email = identifier.toLowerCase();

  if (!identifier.includes('@')) {
    // Username login — the backend /users/search is the only public lookup
    // that can resolve a username → email pairing.
    const search = await apiClient.get('/users/search', { params: { q: identifier, limit: 1 } });
    const users = (search.data?.data ?? []) as any[];
    const match = users.find((u) => (u.username ?? '').toLowerCase() === identifier.toLowerCase());
    if (!match || !match.email) {
      throw Object.assign(new Error('Invalid username or password'), { code: 'UNAUTHORIZED', status: 401 });
    }
    email = match.email;
  }

  const res = await apiClient.post('/auth/login', { email, password: payload.password });
  const data = unwrap<any>(res);
  const accessToken = data.access_token;
  const me = await apiClient.get('/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return {
    user: mapUser(unwrap<any>(me)),
    token: accessToken,
    refreshToken: data.refresh_token,
    expiresIn: Number(data.expires_in ?? 0),
  };
}

/** GET /users/me — the full current-user profile */
export async function getMe(): Promise<MobileUser> {
  const res = await apiClient.get('/users/me');
  return mapUser(unwrap<any>(res));
}

/** PUT /users/me — update profile fields */
export async function updateProfile(updates: Partial<{
  fullName: string; bio: string; website: string; location: string;
  isPrivate: boolean; accountType: string;
}>): Promise<MobileUser> {
  const res = await apiClient.put('/users/me', {
    display_name: updates.fullName,
    bio: updates.bio,
    website: updates.website,
    location: updates.location,
    is_private: updates.isPrivate,
    account_type: updates.accountType,
  });
  return mapUser(unwrap<any>(res));
}

/** POST /auth/logout — invalidates the refresh token server-side */
export async function logout(refreshToken: string): Promise<void> {
  if (!refreshToken) return;
  await apiClient.post('/auth/logout', { refresh_token: refreshToken });
}

/** POST /auth/refresh-token — rotates tokens */
export async function refreshToken(token: string): Promise<{ token: string; refreshToken: string; expiresIn: number }> {
  const res = await apiClient.post('/auth/refresh-token', { refresh_token: token });
  const data = unwrap<any>(res);
  return {
    token: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: Number(data.expires_in ?? 0),
  };
}

/** POST /auth/forgot-password */
export async function forgotPassword(email: string): Promise<void> {
  await apiClient.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
}

/** POST /auth/reset-password */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/reset-password', { token, password: newPassword });
}

/**
 * POST /auth/change-password — optional backend endpoint. Falls back to a
 * typed error when the backend does not expose it yet so the UI can surface
 * an actionable message instead of crashing.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  try {
    await apiClient.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  } catch (err: any) {
    if (err?.status === 404) {
      throw Object.assign(new Error('Password change is not available yet.'), {
        code: 'NOT_IMPLEMENTED',
        status: 501,
      });
    }
    throw err;
  }
}

/**
 * POST /auth/deactivate — same graceful fallback when the endpoint is absent.
 */
export async function deactivateAccount(password: string): Promise<void> {
  try {
    await apiClient.post('/auth/deactivate', { password });
  } catch (err: any) {
    if (err?.status === 404) {
      throw Object.assign(new Error('Account deactivation is not available yet.'), {
        code: 'NOT_IMPLEMENTED',
        status: 501,
      });
    }
    throw err;
  }
}
