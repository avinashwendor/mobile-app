import apiClient from './client';
import { mapComment, unwrap, type MobileComment } from './adapters';

/**
 * Comment API — reads and writes are mounted under `/posts/:postId/comments`
 * and `/reels/:reelId/comments`. Edits, deletes, replies, and like-toggle
 * operations live under `/comments/:commentId`.
 */

export type Comment = MobileComment;

const pageState = new Map<string, string | null>();

const collectionPathFor = (contentType: 'post' | 'reel', contentId: string): string => {
  return contentType === 'post'
    ? `/posts/${contentId}/comments`
    : `/reels/${contentId}/comments`;
};

const commentsPageKey = (contentType: 'post' | 'reel', contentId: string) => `comments:${contentType}:${contentId}`;
const repliesPageKey = (commentId: string) => `replies:${commentId}`;

/** GET comments for a post or reel (cursor paginated). */
export async function getComments(
  contentType: 'post' | 'reel',
  contentId: string,
  page = 1,
  limit = 20,
  _sort: 'newest' | 'oldest' | 'popular' = 'newest',
): Promise<{ comments: Comment[]; hasMore: boolean }> {
  const cursor = page === 1 ? undefined : pageState.get(commentsPageKey(contentType, contentId)) ?? undefined;
  const { data } = await apiClient.get(collectionPathFor(contentType, contentId), {
    params: { cursor, limit },
  });
  const list = Array.isArray(data.data) ? data.data : [];
  pageState.set(commentsPageKey(contentType, contentId), data.meta?.cursor ?? null);
  return {
    comments: list.map((c: any) =>
      mapComment({ ...c, contentType, contentId }),
    ),
    hasMore: Boolean(data.meta?.has_more),
  };
}

/** Create a top-level comment or threaded reply. */
export async function createComment(payload: {
  content: string;
  contentType: 'post' | 'reel';
  contentId: string;
  parentComment?: string;
}): Promise<Comment> {
  if (payload.parentComment) {
    const res = await apiClient.post(`/comments/${payload.parentComment}/reply`, {
      text: payload.content,
    });
    return mapComment({ ...unwrap<any>(res), contentType: payload.contentType, contentId: payload.contentId });
  }

  const res = await apiClient.post(collectionPathFor(payload.contentType, payload.contentId), {
    text: payload.content,
  });
  return mapComment({ ...unwrap<any>(res), contentType: payload.contentType, contentId: payload.contentId });
}

/** GET /comments/:commentId/replies */
export async function getCommentReplies(
  commentId: string,
  page = 1,
  limit = 20,
): Promise<{ replies: Comment[]; hasMore: boolean }> {
  const cursor = page === 1 ? undefined : pageState.get(repliesPageKey(commentId)) ?? undefined;
  const { data } = await apiClient.get(`/comments/${commentId}/replies`, { params: { cursor, limit } });
  const list = Array.isArray(data.data) ? data.data : [];
  pageState.set(repliesPageKey(commentId), data.meta?.cursor ?? null);
  return {
    replies: list.map(mapComment),
    hasMore: Boolean(data.meta?.has_more),
  };
}

/** PUT /comments/:commentId */
export async function editComment(commentId: string, content: string): Promise<Comment> {
  const res = await apiClient.put(`/comments/${commentId}`, { text: content });
  return mapComment(unwrap<any>(res));
}

/** DELETE /comments/:commentId */
export async function deleteComment(commentId: string): Promise<void> {
  await apiClient.delete(`/comments/${commentId}`);
}
