import apiClient from './client';
import { mapUser, type MobileUser } from './adapters';

/**
 * Like API — the backend exposes per-resource endpoints rather than a
 * single `/likes` route, so we route to the correct URL based on
 * `contentType`.
 *
 *   POST/DELETE /posts/:id/like
 *   POST/DELETE /reels/:id/like
 *   POST/DELETE /comments/:id/like
 *   (stories have /stories/:id/react, handled separately in story.api.ts)
 */

export type LikeTarget = 'post' | 'reel' | 'comment';

const routeFor = (type: LikeTarget, id: string): string => {
  switch (type) {
    case 'post': return `/posts/${id}/like`;
    case 'reel': return `/reels/${id}/like`;
    case 'comment': return `/comments/${id}/like`;
  }
};

export async function likeContent(type: LikeTarget | 'story', id: string): Promise<void> {
  if (type === 'story') {
    await apiClient.post(`/stories/${id}/react`, { emoji: '❤️' });
    return;
  }
  await apiClient.post(routeFor(type, id), {});
}

export async function unlikeContent(type: LikeTarget | 'story', id: string): Promise<void> {
  if (type === 'story') return; // backend has no "unreact"
  await apiClient.delete(routeFor(type, id));
}

/** GET /posts/:id/likes — list users who liked a post */
export async function getLikes(
  type: 'post',
  id: string,
  page = 1,
  limit = 20,
): Promise<{ likes: { user: MobileUser }[]; hasMore: boolean; cursor: string | null }> {
  const { data } = await apiClient.get(`/posts/${id}/likes`, { params: { limit } });
  const items: any[] = Array.isArray(data.data) ? data.data : [];
  return {
    likes: items.map((row) => ({ user: mapUser(row.user_id ?? row.user ?? row) })),
    hasMore: Boolean(data.meta?.has_more),
    cursor: data.meta?.cursor ?? null,
  };
}
