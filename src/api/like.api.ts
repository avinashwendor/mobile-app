import apiClient from './client';
import { getDummyLikes } from '../data/dummyData';

/* ───────── Types ───────── */

export interface Like {
  _id: string;
  contentType: 'post' | 'reel' | 'comment' | 'story';
  contentId: string;
}

/* ───────── API Calls ───────── */

/** POST /likes — like content */
export async function likeContent(contentType: Like['contentType'], contentId: string): Promise<void> {
  try {
    await apiClient.post('/likes', { contentType, contentId });
  } catch {
    // Silently succeed offline — optimistic UI handles the state
  }
}

/** DELETE /likes — unlike content (uses request body, not params) */
export async function unlikeContent(contentType: Like['contentType'], contentId: string): Promise<void> {
  try {
    await apiClient.delete('/likes', { data: { contentType, contentId } });
  } catch {
    // Silently succeed offline
  }
}

/** GET /likes/check?contentType=&contentId= — check if current user liked */
export async function checkLiked(
  contentType: Like['contentType'],
  contentId: string,
): Promise<boolean> {
  try {
    const { data } = await apiClient.get('/likes/check', {
      params: { contentType, contentId },
    });
    return data.data.isLiked;
  } catch {
    return false;
  }
}

/** GET /likes/:contentType/:contentId?page=&limit= — get list of users who liked */
export async function getLikes(
  contentType: Like['contentType'],
  contentId: string,
  page = 1,
  limit = 20,
): Promise<{ likes: any[]; hasMore: boolean }> {
  try {
    const { data } = await apiClient.get(`/likes/${contentType}/${contentId}`, {
      params: { page, limit },
    });
    return { likes: data.data.likes, hasMore: data.data.pagination.hasMore };
  } catch {
    return getDummyLikes(contentType, contentId, page, limit);
  }
}
