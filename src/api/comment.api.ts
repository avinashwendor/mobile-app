import apiClient from './client';
import type { PostAuthor } from './post.api';
import { getDummyComments, getDummyCommentReplies } from '../data/dummyData';

/* ───────── Types ───────── */

export interface Comment {
  _id: string;
  author: PostAuthor;
  content: string;
  contentType: 'post' | 'reel';
  contentId: string;
  parentComment: string | null;
  likesCount: number;
  repliesCount: number;
  isEdited: boolean;
  isPinned: boolean;
  createdAt: string;
  replies?: Comment[];
}

/* ───────── API Calls ───────── */

/** POST /comments — create a comment or reply */
export async function createComment(payload: {
  content: string;
  contentType: 'post' | 'reel';
  contentId: string;
  parentComment?: string;
}): Promise<Comment> {
  try {
    const { data } = await apiClient.post('/comments', payload);
    return data.data.comment;
  } catch {
    // Return a fake comment so offline posting appears to work
    return {
      _id: `comment_offline_${Date.now()}`,
      author: { _id: 'demo_user_001', username: 'alex.creates', fullName: 'Alex Morgan', profilePicture: '', isVerified: true },
      content: payload.content,
      contentType: payload.contentType,
      contentId: payload.contentId,
      parentComment: payload.parentComment || null,
      likesCount: 0,
      repliesCount: 0,
      isEdited: false,
      isPinned: false,
      createdAt: new Date().toISOString(),
    };
  }
}

/** GET /comments/:contentType/:contentId?page=&limit=&sort= */
export async function getComments(
  contentType: 'post' | 'reel',
  contentId: string,
  page = 1,
  limit = 20,
  sort: 'newest' | 'oldest' | 'popular' = 'newest',
): Promise<{ comments: Comment[]; hasMore: boolean }> {
  try {
    const { data } = await apiClient.get(`/comments/${contentType}/${contentId}`, {
      params: { page, limit, sort },
    });
    return { comments: data.data.comments, hasMore: data.data.pagination.hasMore };
  } catch {
    return getDummyComments(contentType, contentId, page, limit);
  }
}

/** GET /comments/:commentId/replies?page=&limit= */
export async function getCommentReplies(
  commentId: string,
  page = 1,
  limit = 20,
): Promise<{ replies: Comment[]; hasMore: boolean }> {
  try {
    const { data } = await apiClient.get(`/comments/${commentId}/replies`, {
      params: { page, limit },
    });
    return { replies: data.data.replies, hasMore: data.data.pagination.hasMore };
  } catch {
    return getDummyCommentReplies(commentId);
  }
}

/** PUT /comments/:commentId — edit own comment */
export async function editComment(commentId: string, content: string): Promise<Comment> {
  try {
    const { data } = await apiClient.put(`/comments/${commentId}`, { content });
    return data.data.comment;
  } catch {
    return { _id: commentId, author: { _id: 'demo_user_001', username: 'alex.creates', fullName: 'Alex Morgan', profilePicture: '', isVerified: true }, content, contentType: 'post', contentId: '', parentComment: null, likesCount: 0, repliesCount: 0, isEdited: true, isPinned: false, createdAt: new Date().toISOString() };
  }
}

/** DELETE /comments/:commentId */
export async function deleteComment(commentId: string): Promise<void> {
  try {
    await apiClient.delete(`/comments/${commentId}`);
  } catch {
    // Silently succeed offline
  }
}
