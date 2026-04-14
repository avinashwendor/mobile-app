import apiClient from './client';
import type { BackendUser } from './auth.api';
import {
  getDummySearchResults,
  getDummyUserProfile,
  getDummyUserPosts,
  getDummyUserFollowers,
  getDummyUserFollowing,
} from '../data/dummyData';

/* ───────── Types ───────── */

export interface UserProfile extends BackendUser {
  isFollowing: boolean;
  isFollowedBy: boolean;
  followStatus: 'accepted' | 'pending' | null;
  recentPosts: PostThumbnail[];
  canViewPosts: boolean;
}

export interface PostThumbnail {
  _id: string;
  media: { type: string; url: string; thumbnail?: string }[];
  likesCount: number;
  commentsCount: number;
  createdAt: string;
}

export interface UserSearchResult {
  _id: string;
  username: string;
  fullName: string;
  profilePicture: string;
  isVerified: boolean;
  followersCount: number;
}

/* ───────── API Calls ───────── */

/** GET /users/search?q=&limit=&page= */
export async function searchUsers(
  query: string,
  page = 1,
  limit = 20,
): Promise<{ users: UserSearchResult[]; hasMore: boolean }> {
  try {
    const { data } = await apiClient.get('/users/search', {
      params: { q: query, page, limit },
    });
    return { users: data.data.users, hasMore: data.data.pagination.hasMore };
  } catch {
    return getDummySearchResults(query);
  }
}

/** GET /users/:username — full profile with follow status + recent posts */
export async function getUserProfile(username: string): Promise<UserProfile> {
  try {
    const { data } = await apiClient.get(`/users/${username}`);
    return data.data.user;
  } catch {
    return getDummyUserProfile(username);
  }
}

/** GET /users/:username/posts?page=&limit= */
export async function getUserPosts(
  username: string,
  page = 1,
  limit = 12,
): Promise<{ posts: any[]; hasMore: boolean }> {
  try {
    const { data } = await apiClient.get(`/users/${username}/posts`, {
      params: { page, limit },
    });
    return { posts: data.data.posts, hasMore: data.data.pagination.hasMore };
  } catch {
    return getDummyUserPosts(username);
  }
}

/** GET /users/:username/followers */
export async function getUserFollowers(
  username: string,
  page = 1,
  limit = 20,
): Promise<{ followers: UserSearchResult[]; hasMore: boolean }> {
  try {
    const { data } = await apiClient.get(`/users/${username}/followers`, {
      params: { page, limit },
    });
    return { followers: data.data.followers, hasMore: data.data.pagination.hasMore };
  } catch {
    return getDummyUserFollowers(username);
  }
}

/** GET /users/:username/following */
export async function getUserFollowing(
  username: string,
  page = 1,
  limit = 20,
): Promise<{ following: UserSearchResult[]; hasMore: boolean }> {
  try {
    const { data } = await apiClient.get(`/users/${username}/following`, {
      params: { page, limit },
    });
    return { following: data.data.following, hasMore: data.data.pagination.hasMore };
  } catch {
    return getDummyUserFollowing(username);
  }
}

/** PUT /users/upload-avatar — multipart form-data */
export async function uploadAvatar(imageUri: string): Promise<string> {
  const formData = new FormData();
  const filename = imageUri.split('/').pop() ?? 'avatar.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';
  formData.append('image', { uri: imageUri, name: filename, type } as any);

  try {
    const { data } = await apiClient.put('/users/upload-avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data.profilePicture;
  } catch {
    // Return the local URI as the avatar so it appears to work offline
    return imageUri;
  }
}
