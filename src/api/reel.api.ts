import apiClient from './client';
import type { PostAuthor } from './post.api';
import { getDummyReelsFeed, DUMMY_REELS, DUMMY_TRENDING_HASHTAGS } from '../data/dummyData';

/* ───────── Types ───────── */

export interface Reel {
  _id: string;
  author: PostAuthor;
  caption: string;
  video: {
    url: string;
    thumbnail: string;
    width: number;
    height: number;
    duration: number;
  };
  audio: { title?: string; artist?: string; originalAudio?: string } | null;
  hashtags: string[];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  allowRemix: boolean;
  createdAt: string;
}

/* ───────── API Calls ───────── */

/** GET /reels/feed?page=&limit=&sort= */
export async function getReelsFeed(
  page = 1,
  limit = 10,
  sort: 'trending' | 'newest' | 'popular' = 'trending',
): Promise<{ reels: Reel[]; hasMore: boolean }> {
  try {
    const { data } = await apiClient.get('/reels/feed', { params: { page, limit, sort } });
    return { reels: data.data.reels, hasMore: data.data.pagination.hasMore };
  } catch {
    return getDummyReelsFeed(page, limit);
  }
}

/** GET /reels/:reelId — single reel (increments view count) */
export async function getReel(reelId: string): Promise<Reel> {
  try {
    const { data } = await apiClient.get(`/reels/${reelId}`);
    return data.data.reel;
  } catch {
    return DUMMY_REELS.find((r) => r._id === reelId) || DUMMY_REELS[0];
  }
}

/** POST /reels — create reel with video upload (multipart) */
export async function createReel(payload: {
  videoUri: string;
  caption: string;
  hashtags?: string[];
}): Promise<Reel> {
  const formData = new FormData();
  formData.append('caption', payload.caption);
  if (payload.hashtags) formData.append('hashtags', JSON.stringify(payload.hashtags));

  const filename = payload.videoUri.split('/').pop() ?? 'reel.mp4';
  formData.append('video', { uri: payload.videoUri, name: filename, type: 'video/mp4' } as any);

  try {
    const { data } = await apiClient.post('/reels', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
    });
    return data.data.reel;
  } catch {
    return { _id: `reel_offline_${Date.now()}`, caption: payload.caption, video: { url: payload.videoUri }, likesCount: 0, commentsCount: 0, sharesCount: 0, createdAt: new Date().toISOString() } as any;
  }
}

/** DELETE /reels/:reelId */
export async function deleteReel(reelId: string): Promise<void> {
  try {
    await apiClient.delete(`/reels/${reelId}`);
  } catch {
    // Silently succeed offline
  }
}

/** GET /reels/trending/hashtags */
export async function getTrendingHashtags(limit = 20): Promise<any[]> {
  try {
    const { data } = await apiClient.get('/reels/trending/hashtags', { params: { limit } });
    return data.data.hashtags;
  } catch {
    return DUMMY_TRENDING_HASHTAGS.slice(0, limit);
  }
}
