import apiClient from './client';
import { mapReel, unwrap, type MobileReel, type MobileUser } from './adapters';

/**
 * Reel API — backend routes under `/reels`.
 * Feeds are cursor-paginated; we preserve the caller's page numbering.
 */

export type Reel = MobileReel;
const REEL_UPLOAD_TIMEOUT_MS = 300_000;

const pageState = new Map<string, string | null>();

const fetchReelList = async (path: string, pageKey: string, page: number, limit: number) => {
  const cursor = page === 1 ? undefined : pageState.get(pageKey) ?? undefined;
  const { data } = await apiClient.get(path, { params: { cursor, limit } });
  const items: any[] = Array.isArray(data.data) ? data.data : [];
  pageState.set(pageKey, data.meta?.cursor ?? null);
  return {
    reels: items.map(mapReel),
    hasMore: Boolean(data.meta?.has_more),
    page,
  };
};

export async function getReelsFeed(
  page = 1,
  limit = 10,
  sort: 'trending' | 'newest' | 'popular' = 'trending',
): Promise<{ reels: Reel[]; hasMore: boolean; page: number }> {
  const path = sort === 'trending' ? '/reels/trending' : sort === 'popular' ? '/reels/for-you' : '/reels/feed';
  return fetchReelList(path, `feed-${sort}`, page, limit);
}

export async function getReel(reelId: string): Promise<Reel> {
  const res = await apiClient.get(`/reels/${reelId}`);
  return mapReel(unwrap<any>(res));
}

export async function createReel(payload: {
  videoUri: string;
  caption: string;
  hashtags?: string[];
}): Promise<Reel> {
  const formData = new FormData();
  if (payload.caption) formData.append('description', payload.caption);
  if (payload.hashtags?.length) formData.append('hashtags', JSON.stringify(payload.hashtags));

  const filename = payload.videoUri.split('/').pop() ?? 'reel.mp4';
  formData.append('video', { uri: payload.videoUri, name: filename, type: 'video/mp4' } as any);

  const res = await apiClient.post('/reels', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: REEL_UPLOAD_TIMEOUT_MS,
  });
  return mapReel(unwrap<any>(res));
}

export async function deleteReel(reelId: string): Promise<void> {
  await apiClient.delete(`/reels/${reelId}`);
}

export async function saveReel(reelId: string): Promise<void> {
  await apiClient.post(`/reels/${reelId}/save`, {});
}

export async function shareReel(
  reelId: string,
  shareType: 'dm' | 'external' | 'copy_link',
  extras: { recipientId?: string; platform?: string } = {},
): Promise<void> {
  await apiClient.post(`/reels/${reelId}/share`, {
    share_type: shareType,
    recipient_id: extras.recipientId,
    platform: extras.platform,
  });
}

/** No trending-hashtag endpoint yet — return empty list so UI renders nothing. */
export async function getTrendingHashtags(_limit = 20): Promise<{ name: string; count?: number }[]> {
  return [];
}
