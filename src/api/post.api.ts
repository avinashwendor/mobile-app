import apiClient from './client';
import {
  mapPost,
  mapReel,
  unwrap,
  type MobilePost,
  type MobileReel,
  type MobileUser,
  mapUser,
} from './adapters';

/**
 * Post API — wraps `/posts/*` on the backend.
 *
 * The backend uses cursor-based pagination; the mobile screens are written
 * around page-style `{ posts, hasMore, page }` so we translate on the way
 * out. Because page numbers can't be expressed as cursors, we just forward
 * the previous response cursor via the `cursor` param — the `page` field
 * is preserved for UI state only.
 */

export type { MobileUser as PostAuthor, MobilePost as Post };

export interface PostMedia {
  type: 'image' | 'video';
  url: string;
  thumbnail: string | null;
  width: number;
  height: number;
  duration?: number;
}

export interface PaginatedPosts {
  posts: MobilePost[];
  hasMore: boolean;
  page: number;
  cursor: string | null;
}

const pageState = new Map<string, string | null>();

const fetchPostList = async (path: string, pageKey: string, page: number, limit: number): Promise<PaginatedPosts> => {
  const cursor = page === 1 ? undefined : pageState.get(pageKey) ?? undefined;
  const { data } = await apiClient.get(path, { params: { cursor, limit } });
  const items: any[] = Array.isArray(data.data) ? data.data : data.data?.items ?? [];
  const nextCursor = data.meta?.cursor ?? null;
  pageState.set(pageKey, nextCursor);
  return {
    posts: items.map(mapPost),
    hasMore: Boolean(data.meta?.has_more),
    page,
    cursor: nextCursor,
  };
};

/** GET /posts/feed — authenticated feed (followed users + suggested) */
export async function getFeed(page = 1, limit = 10): Promise<PaginatedPosts> {
  return fetchPostList('/posts/feed', 'feed', page, limit);
}

/** GET /posts/explore — trending posts from across the platform */
export async function getExplore(page = 1, limit = 20): Promise<PaginatedPosts> {
  return fetchPostList('/posts/explore', 'explore', page, limit);
}

/** GET /posts/:postId — single post */
export async function getPost(postId: string): Promise<MobilePost> {
  const res = await apiClient.get(`/posts/${postId}`);
  return mapPost(unwrap<any>(res));
}

/** Map UI visibility to backend POST_TYPES / VISIBILITY_OPTIONS. */
const mapPostVisibility = (
  v?: 'public' | 'private' | 'followers',
): 'public' | 'followers' | 'close_friends' => {
  if (v === 'private') return 'close_friends';
  if (v === 'followers') return 'followers';
  return 'public';
};

function derivePostType(mediaFiles: { type: string }[]): 'image' | 'video' | 'carousel' {
  if (mediaFiles.length > 1) return 'carousel';
  if (mediaFiles.some((f) => f.type.startsWith('video'))) return 'video';
  return 'image';
}

/** POST /posts — create with multipart media upload */
export async function createPost(payload: {
  caption: string;
  mediaFiles: { uri: string; type: string }[];
  location?: string;
  tags?: string[];
  visibility?: 'public' | 'private' | 'followers';
  commentsEnabled?: boolean;
  likesVisible?: boolean;
}): Promise<MobilePost> {
  const formData = new FormData();
  formData.append('type', derivePostType(payload.mediaFiles));
  if (payload.caption !== undefined && payload.caption !== '') {
    formData.append('caption', payload.caption);
  }
  if (payload.location) formData.append('location', JSON.stringify({ name: payload.location }));
  formData.append('visibility', mapPostVisibility(payload.visibility));
  if (payload.commentsEnabled !== undefined) {
    formData.append('comments_enabled', payload.commentsEnabled ? 'true' : 'false');
  }
  if (payload.likesVisible !== undefined) {
    formData.append('likes_visible', payload.likesVisible ? 'true' : 'false');
  }

  for (const file of payload.mediaFiles) {
    const filename = file.uri.split('/').pop() ?? 'media.jpg';
    const isVideo = file.type.startsWith('video');
    formData.append('media', {
      uri: file.uri,
      name: filename,
      type: isVideo ? 'video/mp4' : 'image/jpeg',
    } as any);
  }

  const res = await apiClient.post('/posts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
  });
  return mapPost(unwrap<any>(res));
}

/** PUT /posts/:postId — edit caption / settings */
export async function updatePost(
  postId: string,
  updates: { caption?: string; commentsDisabled?: boolean; hideLikesCount?: boolean },
): Promise<MobilePost> {
  const body: any = {};
  if (updates.caption !== undefined) body.caption = updates.caption;
  if (updates.commentsDisabled !== undefined) body.comments_enabled = !updates.commentsDisabled;
  if (updates.hideLikesCount !== undefined) body.likes_visible = !updates.hideLikesCount;

  const res = await apiClient.put(`/posts/${postId}`, body);
  return mapPost(unwrap<any>(res));
}

/** DELETE /posts/:postId */
export async function deletePost(postId: string): Promise<void> {
  await apiClient.delete(`/posts/${postId}`);
}

/** POST/DELETE /posts/:postId/save — toggle save/unsave */
export async function toggleSavePost(postId: string, currentlySaved = false): Promise<boolean> {
  if (currentlySaved) {
    await apiClient.delete(`/posts/${postId}/save`);
    return false;
  }
  await apiClient.post(`/posts/${postId}/save`, {});
  return true;
}

/** POST /posts/:postId/share */
export async function sharePost(
  postId: string,
  shareType: 'dm' | 'external' | 'copy_link',
  extras: { recipientId?: string; platform?: string } = {},
): Promise<void> {
  await apiClient.post(`/posts/${postId}/share`, {
    share_type: shareType,
    recipient_id: extras.recipientId,
    platform: extras.platform,
  });
}

/** PUT /posts/:postId/pin */
export async function togglePinPost(postId: string): Promise<boolean> {
  const res = await apiClient.put(`/posts/${postId}/pin`);
  return Boolean(unwrap<any>(res).is_pinned);
}

/** One saved row from GET /saved (post or reel, with save metadata). */
export type SavedFeedItem =
  | { kind: 'post'; saveId: string; collectionName: string; post: MobilePost }
  | { kind: 'reel'; saveId: string; collectionName: string; reel: MobileReel };

/** GET /saved — authenticated user's saved posts and reels */
export async function getSavedPosts(page = 1, limit = 20): Promise<{ items: SavedFeedItem[]; hasMore: boolean }> {
  if (page === 1) pageState.delete('saved');
  const cursor = page === 1 ? undefined : pageState.get('saved') ?? undefined;
  const { data } = await apiClient.get('/saved', { params: { cursor, limit } });
  const rows: any[] = Array.isArray(data.data) ? data.data : [];
  pageState.set('saved', data.meta?.cursor ?? null);

  const items: SavedFeedItem[] = [];
  for (const row of rows) {
    const saveId = String(row._id ?? row.id ?? '');
    const collectionName = String(row.collection_name ?? 'All Posts');
    if (row.target_type === 'reel' && row.reel) {
      items.push({ kind: 'reel', saveId, collectionName, reel: mapReel(row.reel) });
    } else if (row.target_type === 'post' && row.post) {
      items.push({ kind: 'post', saveId, collectionName, post: mapPost(row.post) });
    }
  }

  return {
    items,
    hasMore: Boolean(data.meta?.has_more),
  };
}
