import apiClient from './client';
import { mapStory, mapUser, unwrap, type MobileStory, type MobileUser } from './adapters';

/**
 * Story API — backend mounts all routes under `/stories`.
 * Feed returns a flat list of stories; we group them by author on the
 * client so the home screen can render one ring per user.
 */

export type Story = MobileStory;

export interface StoryGroup {
  author: MobileUser;
  stories: MobileStory[];
  hasViewed: boolean;
}

export interface StoryInsights {
  storyId: string;
  viewsCount: number;
  likesCount: number;
  reactionsCount: number;
  viewers: { user: MobileUser; viewedAt: string }[];
  likes: { user: MobileUser; reactedAt: string; emoji: string }[];
}

/** GET /stories/feed — flatten → group by author for the home row. */
export async function getStoryFeed(): Promise<StoryGroup[]> {
  const { data } = await apiClient.get('/stories/feed', { params: { limit: 50 } });
  const list: any[] = Array.isArray(data.data) ? data.data : [];
  const mapped = list.map(mapStory);

  const groups = new Map<string, StoryGroup>();
  for (const story of mapped) {
    const authorId = story.author._id;
    if (!authorId) continue;
    const group = groups.get(authorId);
    if (group) {
      group.stories.push(story);
      group.hasViewed = group.hasViewed && story.hasViewed;
    } else {
      groups.set(authorId, {
        author: story.author,
        stories: [story],
        hasViewed: story.hasViewed,
      });
    }
  }
  // Authors with at least one unseen story sort first, newest stories inside each group.
  return Array.from(groups.values())
    .map((g) => ({
      ...g,
      stories: g.stories.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    }))
    .sort((a, b) => {
      const viewed = Number(a.hasViewed) - Number(b.hasViewed);
      if (viewed !== 0) return viewed;
      const aLatest = a.stories[0]?.createdAt ?? '';
      const bLatest = b.stories[0]?.createdAt ?? '';
      return +new Date(bLatest) - +new Date(aLatest);
    });
}

/** GET /users/:id/stories — not exposed today; derive from /stories/feed. */
export async function getUserStories(userId: string): Promise<Story[]> {
  const { data } = await apiClient.get(`/stories/user/${userId}`);
  const list: any[] = Array.isArray(data.data) ? data.data : [];
  return list.map(mapStory);
}

/** GET /stories/:id */
export async function getStory(storyId: string): Promise<Story> {
  const res = await apiClient.get(`/stories/${storyId}`);
  return mapStory(unwrap<any>(res));
}

/** POST /stories/:id/view — mark as viewed */
export async function viewStory(storyId: string): Promise<void> {
  await apiClient.post(`/stories/${storyId}/view`, {});
}

/** POST /stories/:id/react */
export async function reactToStory(storyId: string, emoji = '❤️'): Promise<void> {
  await apiClient.post(`/stories/${storyId}/react`, { emoji });
}

/** POST /stories — multipart upload */
export async function createStory(payload: {
  mediaUri?: string;
  mediaType?: 'image' | 'video';
  text?: string;
  visibility?: 'public' | 'followers' | 'close-friends';
  filterId?: string;
  audioTrackId?: string;
}): Promise<Story> {
  const formData = new FormData();
  if (payload.visibility) formData.append('visibility', payload.visibility === 'close-friends' ? 'close_friends' : payload.visibility);
  if (payload.text) formData.append('caption', payload.text);
  if (payload.filterId) formData.append('filter_id', payload.filterId);
  if (payload.audioTrackId) formData.append('audio_track_id', payload.audioTrackId);

  if (payload.mediaUri) {
    const filename = payload.mediaUri.split('/').pop() ?? 'story.jpg';
    const isVideo = payload.mediaType === 'video';
    formData.append('media', {
      uri: payload.mediaUri,
      name: filename,
      type: isVideo ? 'video/mp4' : 'image/jpeg',
    } as any);
  }

  const res = await apiClient.post('/stories', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
  });
  return mapStory(unwrap<any>(res));
}

/** DELETE /stories/:id */
export async function deleteStory(storyId: string): Promise<void> {
  await apiClient.delete(`/stories/${storyId}`);
}

/** GET /stories/:id/viewers — owner only */
export async function getStoryViews(storyId: string): Promise<{ user: MobileUser; viewedAt: string }[]> {
  const { data } = await apiClient.get(`/stories/${storyId}/viewers`);
  const list: any[] = Array.isArray(data.data) ? data.data : [];
  return list.map((row) => ({
    user: mapUser(row.user_id ?? row.user ?? {}),
    viewedAt: row.viewed_at ?? row.viewedAt ?? new Date().toISOString(),
  }));
}

export async function getStoryInsights(storyId: string): Promise<StoryInsights> {
  const { data } = await apiClient.get(`/stories/${storyId}/insights`);
  const payload = data.data ?? {};
  const viewers = Array.isArray(payload.viewers) ? payload.viewers : [];
  const likes = Array.isArray(payload.likes) ? payload.likes : [];

  return {
    storyId: String(payload.story_id ?? payload.storyId ?? storyId),
    viewsCount: Number(payload.views_count ?? payload.viewsCount ?? viewers.length),
    likesCount: Number(payload.likes_count ?? payload.likesCount ?? likes.length),
    reactionsCount: Number(payload.reactions_count ?? payload.reactionsCount ?? likes.length),
    viewers: viewers.map((viewer: any) => ({
      user: mapUser(viewer.user ?? viewer.user_id ?? {}),
      viewedAt: String(viewer.viewed_at ?? viewer.viewedAt ?? new Date().toISOString()),
    })),
    likes: likes.map((reaction: any) => ({
      user: mapUser(reaction.user ?? reaction.user_id ?? {}),
      reactedAt: String(reaction.reacted_at ?? reaction.reactedAt ?? reaction.created_at ?? new Date().toISOString()),
      emoji: String(reaction.emoji ?? '❤️'),
    })),
  };
}
