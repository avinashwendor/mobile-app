import apiClient from './client';
import { DUMMY_FOLLOW_REQUESTS, getDummyMutualFollowers } from '../data/dummyData';

/* ───────── Types ───────── */

export interface FollowResult {
  _id: string;
  follower: string;
  following: string;
  status: 'accepted' | 'pending';
  createdAt: string;
}

export interface FollowRequest {
  _id: string;
  user: {
    _id: string;
    username: string;
    fullName: string;
    profilePicture: string;
    isVerified: boolean;
  };
  createdAt: string;
}

/* ───────── API Calls ───────── */

/** POST /follows/:userId — follow a user */
export async function followUser(userId: string): Promise<FollowResult> {
  try {
    const { data } = await apiClient.post(`/follows/${userId}`);
    return data.data.follow;
  } catch {
    return { _id: `follow_${Date.now()}`, follower: 'demo_user_001', following: userId, status: 'accepted', createdAt: new Date().toISOString() };
  }
}

/** DELETE /follows/:userId — unfollow a user */
export async function unfollowUser(userId: string): Promise<void> {
  try {
    await apiClient.delete(`/follows/${userId}`);
  } catch {
    // Silently succeed offline
  }
}

/** GET /follows/requests — pending follow requests for current user */
export async function getFollowRequests(
  page = 1,
  limit = 20,
): Promise<{ requests: FollowRequest[]; hasMore: boolean }> {
  try {
    const { data } = await apiClient.get('/follows/requests', { params: { page, limit } });
    return { requests: data.data.requests, hasMore: data.data.pagination.hasMore };
  } catch {
    return { requests: DUMMY_FOLLOW_REQUESTS, hasMore: false };
  }
}

/** POST /follows/requests/:requestId/accept */
export async function acceptFollowRequest(requestId: string): Promise<void> {
  try {
    await apiClient.post(`/follows/requests/${requestId}/accept`);
  } catch {
    // Silently succeed offline
  }
}

/** DELETE /follows/requests/:requestId — decline a follow request */
export async function declineFollowRequest(requestId: string): Promise<void> {
  try {
    await apiClient.delete(`/follows/requests/${requestId}`);
  } catch {
    // Silently succeed offline
  }
}

/** GET /follows/mutual/:userId — get mutual followers */
export async function getMutualFollowers(
  userId: string,
  limit = 10,
): Promise<{ mutualFollowers: any[]; count: number }> {
  try {
    const { data } = await apiClient.get(`/follows/mutual/${userId}`, { params: { limit } });
    return data.data;
  } catch {
    return getDummyMutualFollowers(userId);
  }
}
