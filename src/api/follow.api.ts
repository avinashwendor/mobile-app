import apiClient from './client';
import { mapUser, type MobileUser } from './adapters';

/**
 * Follow API — thin wrapper around `/users/:userId/follow` and related
 * endpoints. The backend returns `{ status: 'active' | 'pending' }` on
 * follow; the app model normalizes to `'accepted' | 'pending'`.
 */

export interface FollowResult {
  status: 'accepted' | 'pending';
}

export interface FollowRequest {
  _id: string;
  user: MobileUser;
  createdAt: string;
}

export async function followUser(userId: string): Promise<FollowResult> {
  const res = await apiClient.post(`/users/${userId}/follow`, {});
  const raw = res.data?.data ?? {};
  const status = raw.status === 'pending' ? 'pending' : 'accepted';
  return { status };
}

export async function unfollowUser(userId: string): Promise<void> {
  await apiClient.delete(`/users/${userId}/follow`);
}

export async function blockUser(userId: string): Promise<void> {
  await apiClient.post(`/users/${userId}/block`, {});
}

export async function unblockUser(userId: string): Promise<void> {
  await apiClient.delete(`/users/${userId}/block`);
}

/**
 * Pending follow requests aren't exposed as a dedicated endpoint on the
 * backend; they live as Follower documents with status=pending. We surface
 * an empty list when no feed endpoint is available, rather than pretending
 * with dummy data. When a follow-requests endpoint is wired up, point this
 * at it.
 */
export async function getFollowRequests(
  _page: number = 1,
  _limit: number = 20,
): Promise<{ requests: FollowRequest[]; hasMore: boolean }> {
  return { requests: [], hasMore: false };
}

export async function acceptFollowRequest(_requestId: string): Promise<void> {
  throw Object.assign(new Error('Follow request management is not yet supported by the API'), { code: 'NOT_IMPLEMENTED' });
}

export async function declineFollowRequest(_requestId: string): Promise<void> {
  throw Object.assign(new Error('Follow request management is not yet supported by the API'), { code: 'NOT_IMPLEMENTED' });
}
