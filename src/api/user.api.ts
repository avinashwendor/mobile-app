import apiClient from './client';
import {
  mapPost,
  mapReel,
  mapUser,
  type MobilePost,
  type MobileReel,
  type MobileUser,
} from './adapters';

/**
 * User API — resolve user profiles, lists, and search results.
 *
 * The backend identifies users by `userId` (Mongo ObjectId), not username.
 * To preserve mobile routing by `@username` we search first, then fetch
 * the profile by id. IDs are cached to avoid the extra round-trip on
 * repeat navigation.
 */

export interface PostThumbnail {
  _id: string;
  media: { type: string; url: string; thumbnail?: string }[];
  likesCount: number;
  commentsCount: number;
  createdAt: string;
}

export type UserProfile = MobileUser & {
  recentPosts: PostThumbnail[];
  canViewPosts: boolean;
  followStatus: 'accepted' | 'pending' | null;
};

export interface MyProfileMedia {
  ownPosts: MobilePost[];
  ownReels: MobileReel[];
  collaboratedPosts: MobilePost[];
  collaboratedReels: MobileReel[];
  taggedPosts: MobilePost[];
  taggedReels: MobileReel[];
}

export interface UserSearchResult {
  _id: string;
  username: string;
  fullName: string;
  profilePicture: string;
  isVerified: boolean;
  followersCount: number;
  mutualFollowersCount?: number;
  mutualFollowers?: string[];
}

/** Small in-memory cache from username → userId for avatar-pressed navigation */
const usernameToId = new Map<string, string>();

const toSearchResult = (raw: any): UserSearchResult => {
  const user = mapUser(raw);
  return {
    _id: user._id,
    username: user.username,
    fullName: user.fullName,
    profilePicture: user.profilePicture,
    isVerified: user.isVerified,
    followersCount: user.followersCount,
    mutualFollowersCount: Number(raw?.mutual_followers_count ?? raw?.mutualFollowersCount ?? 0),
    mutualFollowers: Array.isArray(raw?.mutual_followers)
      ? raw.mutual_followers.map((value: unknown) => String(value))
      : Array.isArray(raw?.mutualFollowers)
        ? raw.mutualFollowers.map((value: unknown) => String(value))
        : [],
  };
};

const resolveUserId = async (identifier: string): Promise<string> => {
  // If it looks like an ObjectId, use it directly.
  if (/^[a-f\d]{24}$/i.test(identifier)) return identifier;
  const cached = usernameToId.get(identifier.toLowerCase());
  if (cached) return cached;

  const { data } = await apiClient.get('/users/search', {
    params: { q: identifier, limit: 5 },
  });
  const list = (data?.data ?? []) as any[];
  const match = list.find((u) => (u.username ?? '').toLowerCase() === identifier.toLowerCase())
    ?? list[0];
  if (!match) {
    throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND', status: 404 });
  }
  const id = String(match._id ?? match.id);
  usernameToId.set((match.username ?? '').toLowerCase(), id);
  return id;
};

/** GET /users/search?q= */
export async function searchUsers(
  query: string,
  _page = 1,
  limit = 20,
): Promise<{ users: UserSearchResult[]; hasMore: boolean }> {
  const { data } = await apiClient.get('/users/search', { params: { q: query, limit } });
  const list = Array.isArray(data.data) ? data.data : [];
  return {
    users: list.map(toSearchResult),
    hasMore: Boolean(data.meta?.has_more),
  };
}

/** GET /users/suggestions */
export async function getSuggestions(limit = 20): Promise<UserSearchResult[]> {
  const { data } = await apiClient.get('/users/suggestions', { params: { limit } });
  const list = Array.isArray(data.data) ? data.data : [];
  return list.map(toSearchResult);
}

/** Full profile by username or id. */
export async function getUserProfile(usernameOrId: string): Promise<UserProfile> {
  const id = await resolveUserId(usernameOrId);
  const { data } = await apiClient.get(`/users/${id}`);
  const base = mapUser(data.data);
  // Posts thumbnails aren't part of the profile response — fetch them too.
  // The backend doesn't expose /users/:id/posts, so we fall back to a feed
  // filter via /posts/explore? Not ideal. We leave the list empty for now
  // and let the profile screen load posts separately if/when the route is
  // added. This keeps the app honest (no dummy data).
  return {
    ...base,
    recentPosts: [],
    canViewPosts: !base.isPrivate || Boolean(base.isFollowing),
    followStatus: base.followStatus ?? (base.isFollowing ? 'accepted' : null),
  };
}

/** Empty stub — backend does not expose /users/:id/posts yet. */
export async function getUserPosts(
  _usernameOrId: string,
  _page = 1,
  _limit = 12,
): Promise<{ posts: MobilePost[]; hasMore: boolean }> {
  return { posts: [], hasMore: false };
}

/** Current user's profile media buckets for the profile dashboard tabs. */
export async function getMyProfileMedia(limit = 60): Promise<MyProfileMedia> {
  const { data } = await apiClient.get('/users/me/profile-media', {
    params: { limit },
  });
  const raw = data?.data ?? {};

  return {
    ownPosts: Array.isArray(raw.own_posts) ? raw.own_posts.map(mapPost) : [],
    ownReels: Array.isArray(raw.own_reels) ? raw.own_reels.map(mapReel) : [],
    collaboratedPosts: Array.isArray(raw.collaborated_posts) ? raw.collaborated_posts.map(mapPost) : [],
    collaboratedReels: Array.isArray(raw.collaborated_reels) ? raw.collaborated_reels.map(mapReel) : [],
    taggedPosts: Array.isArray(raw.tagged_posts) ? raw.tagged_posts.map(mapPost) : [],
    taggedReels: Array.isArray(raw.tagged_reels) ? raw.tagged_reels.map(mapReel) : [],
  };
}

export async function getUserFollowers(
  usernameOrId: string,
  _page = 1,
  limit = 20,
): Promise<{ followers: UserSearchResult[]; hasMore: boolean }> {
  const id = await resolveUserId(usernameOrId);
  const { data } = await apiClient.get(`/users/${id}/followers`, { params: { limit } });
  const list = Array.isArray(data.data) ? data.data : [];
  return {
    followers: list
      .map((row: any) => toSearchResult(row.follower_id ?? row.user_id ?? row)),
    hasMore: Boolean(data.meta?.has_more),
  };
}

export async function getUserFollowing(
  usernameOrId: string,
  _page = 1,
  limit = 20,
): Promise<{ following: UserSearchResult[]; hasMore: boolean }> {
  const id = await resolveUserId(usernameOrId);
  const { data } = await apiClient.get(`/users/${id}/following`, { params: { limit } });
  const list = Array.isArray(data.data) ? data.data : [];
  return {
    following: list
      .map((row: any) => toSearchResult(row.following_id ?? row.user_id ?? row)),
    hasMore: Boolean(data.meta?.has_more),
  };
}

/** PUT /users/me/avatar — multipart upload */
export async function uploadAvatar(imageUri: string): Promise<string> {
  const formData = new FormData();
  const filename = imageUri.split('/').pop() ?? 'avatar.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';
  formData.append('avatar', { uri: imageUri, name: filename, type } as any);

  const res = await apiClient.put('/users/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000,
  });
  const user = mapUser(res.data?.data);
  return user.profilePicture;
}
