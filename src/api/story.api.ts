import apiClient from './client';
import type { PostAuthor } from './post.api';
import { DUMMY_STORY_GROUPS, getDummyUserStories } from '../data/dummyData';

/* ───────── Types ───────── */

export interface Story {
  _id: string;
  author: PostAuthor;
  media: { type: 'image' | 'video'; url: string; thumbnail?: string } | null;
  text: { content: string } | null;
  visibility: 'public' | 'followers' | 'close-friends';
  viewsCount: number;
  hasViewed?: boolean;
  createdAt: string;
}

export interface StoryGroup {
  author: PostAuthor;
  stories: Story[];
  hasViewed: boolean;
}

/* ───────── API Calls ───────── */

/** GET /stories/feed — story groups from followed users */
export async function getStoryFeed(): Promise<StoryGroup[]> {
  try {
    const { data } = await apiClient.get('/stories/feed');
    return data.data.storyGroups;
  } catch {
    return DUMMY_STORY_GROUPS;
  }
}

/** GET /stories/user/:userId — get a specific user's stories */
export async function getUserStories(userId: string): Promise<Story[]> {
  try {
    const { data } = await apiClient.get(`/stories/user/${userId}`);
    return data.data.stories;
  } catch {
    return getDummyUserStories(userId);
  }
}

/** GET /stories/:storyId — single story (marks as viewed) */
export async function getStory(storyId: string): Promise<Story> {
  try {
    const { data } = await apiClient.get(`/stories/${storyId}`);
    return data.data.story;
  } catch {
    const stories = getDummyUserStories('u1');
    return stories.find((s) => s._id === storyId) || stories[0];
  }
}

/** POST /stories — create a story with media or text */
export async function createStory(payload: {
  mediaUri?: string;
  mediaType?: 'image' | 'video';
  text?: string;
  visibility?: 'public' | 'followers' | 'close-friends';
}): Promise<Story> {
  const formData = new FormData();

  if (payload.text) formData.append('text', payload.text);
  if (payload.visibility) formData.append('visibility', payload.visibility);

  if (payload.mediaUri) {
    const filename = payload.mediaUri.split('/').pop() ?? 'story.jpg';
    const isVideo = payload.mediaType === 'video';
    formData.append('media', {
      uri: payload.mediaUri,
      name: filename,
      type: isVideo ? 'video/mp4' : 'image/jpeg',
    } as any);
  }

  try {
    const { data } = await apiClient.post('/stories', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    });
    return data.data.story;
  } catch {
    return { _id: `story_offline_${Date.now()}`, media: { url: payload.mediaUri, type: payload.mediaType || 'image' }, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString() } as any;
  }
}

/** DELETE /stories/:storyId */
export async function deleteStory(storyId: string): Promise<void> {
  try {
    await apiClient.delete(`/stories/${storyId}`);
  } catch {
    // Silently succeed offline
  }
}

/** GET /stories/:storyId/views — get viewers (story owner only) */
export async function getStoryViews(storyId: string): Promise<any[]> {
  try {
    const { data } = await apiClient.get(`/stories/${storyId}/views`);
    return data.data.views;
  } catch {
    return [];
  }
}
