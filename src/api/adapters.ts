/**
 * Adapters — translate between the backend's snake_case / cursor-paginated
 * wire format and the camelCase shapes consumed by the mobile screens.
 *
 * The backend envelope is `{ success, data, meta? }` and lists are returned
 * as `{ success: true, data: <array>, meta: { cursor, has_more } }`.
 *
 * Every external API module in this folder must funnel responses through
 * these adapters so the rest of the app stays in a single shape.
 */

import type { AxiosResponse } from 'axios';

export interface Paginated<T> {
  items: T[];
  hasMore: boolean;
  cursor: string | null;
}

export interface BackendEnvelope<T> {
  success: boolean;
  data: T;
  meta?: { cursor?: string | null; has_more?: boolean; total?: number };
}

/** Pick the first defined value. Accepts any falsy-but-valid values (0, ''). */
const pick = <T>(...vals: (T | undefined | null)[]): T | undefined => {
  for (const v of vals) if (v !== undefined && v !== null) return v;
  return undefined;
};

export const unwrap = <T>(res: AxiosResponse<BackendEnvelope<T>>): T => res.data.data;

export const unwrapList = <T, U = T>(
  res: AxiosResponse<BackendEnvelope<T[] | any>>,
  mapItem: (item: T) => U = (x) => x as unknown as U,
): Paginated<U> => {
  const body = res.data;
  const raw = Array.isArray(body.data) ? body.data : (body.data as any)?.items ?? [];
  const meta = body.meta ?? {};
  return {
    items: raw.map(mapItem),
    hasMore: Boolean(meta.has_more),
    cursor: meta.cursor ?? null,
  };
};

/** Build a sane public URL for a media asset coming back from the backend. */
export const normalizeMediaUrl = (input: any): string => {
  if (!input) return '';
  if (typeof input === 'string') return input;
  return input.url || input.secure_url || input.src || '';
};

/* ───────── User ───────── */

export interface MobileUser {
  _id: string;
  username: string;
  email: string;
  fullName: string;
  profilePicture: string;
  coverPicture: string;
  bio: string;
  website: string;
  socialLinks: string[];
  isVerified: boolean;
  isPrivate: boolean;
  accountType: string;
  membershipTier: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  reelsCount: number;
  isFollowing?: boolean;
  isFollowedBy?: boolean;
  isBlocked?: boolean;
  followStatus?: 'accepted' | 'pending' | null;
}

export const mapUser = (u: any): MobileUser => {
  if (!u) return u;
  const id = pick<string>(u._id, u.id) ?? '';
  const socialLinks = pick<any[]>(u.socialLinks, u.social_links);
  return {
    _id: String(id),
    username: u.username ?? '',
    email: u.email ?? '',
    fullName: pick(u.fullName, u.display_name, u.name) ?? u.username ?? '',
    profilePicture: pick(u.profilePicture, u.avatar_url, u.avatarUrl) ?? '',
    coverPicture: pick(u.coverPicture, u.cover_url, u.coverUrl) ?? '',
    bio: u.bio ?? '',
    website: u.website ?? '',
    socialLinks: Array.isArray(socialLinks) ? socialLinks.map((link) => String(link)).filter(Boolean) : [],
    isVerified: Boolean(pick(u.isVerified, u.is_verified)),
    isPrivate: Boolean(pick(u.isPrivate, u.is_private)),
    accountType: pick(u.accountType, u.account_type) ?? 'personal',
    membershipTier: pick(u.membershipTier, u.membership_tier) ?? 'free',
    followersCount: Number(pick(u.followersCount, u.followers_count) ?? 0),
    followingCount: Number(pick(u.followingCount, u.following_count) ?? 0),
    postsCount: Number(pick(u.postsCount, u.posts_count) ?? 0),
    reelsCount: Number(pick(u.reelsCount, u.reels_count) ?? 0),
    isFollowing: pick(u.isFollowing, u.is_following) ?? undefined,
    isFollowedBy: pick(u.isFollowedBy, u.is_followed_by) ?? undefined,
    isBlocked: pick(u.isBlocked, u.is_blocked) ?? undefined,
    followStatus: pick(u.followStatus, u.follow_status) ?? null,
  };
};

/* ───────── Post ───────── */

export interface MobileMedia {
  type: 'image' | 'video';
  url: string;
  thumbnail: string | null;
  width: number;
  height: number;
  duration?: number;
}

export interface MobilePost {
  _id: string;
  author: MobileUser;
  caption: string;
  media: MobileMedia[];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  tags: string[];
  location: { name: string; coordinates?: number[] } | null;
  commentsDisabled: boolean;
  hideLikesCount: boolean;
  isArchived: boolean;
  isLiked: boolean;
  isSaved: boolean;
  createdAt: string;
  updatedAt: string;
}

const mapMediaItem = (m: any): MobileMedia => ({
  type: (m?.type ?? 'image') as MobileMedia['type'],
  url: normalizeMediaUrl(m),
  thumbnail: pick(m?.thumbnail, m?.thumbnail_url, m?.thumbnailUrl) ?? null,
  width: Number(m?.width ?? 1080),
  height: Number(m?.height ?? 1080),
  duration: m?.duration ? Number(m.duration) : undefined,
});

export const mapPost = (p: any): MobilePost => {
  if (!p) return p;
  const authorRaw = p.author ?? p.user_id ?? p.user ?? {};
  const createdAt = pick(p.createdAt, p.created_at) ?? new Date().toISOString();
  const updatedAt = pick(p.updatedAt, p.updated_at) ?? createdAt;
  const media = Array.isArray(p.media) ? p.media.map(mapMediaItem) : [];
  return {
    _id: String(pick(p._id, p.id) ?? ''),
    author: mapUser(authorRaw),
    caption: p.caption ?? '',
    media,
    likesCount: Number(pick(p.likesCount, p.likes_count) ?? 0),
    commentsCount: Number(pick(p.commentsCount, p.comments_count) ?? 0),
    sharesCount: Number(pick(p.sharesCount, p.shares_count) ?? 0),
    viewsCount: Number(pick(p.viewsCount, p.views_count) ?? 0),
    tags: Array.isArray(p.tags) ? p.tags : Array.isArray(p.hashtags) ? p.hashtags : [],
    location: p.location ?? null,
    commentsDisabled: !pick(p.commentsEnabled, p.comments_enabled, true),
    hideLikesCount: !pick(p.likesVisible, p.likes_visible, true),
    isArchived: Boolean(pick(p.isArchived, p.is_archived)),
    isLiked: Boolean(pick(p.isLiked, p.is_liked)),
    isSaved: Boolean(pick(p.isSaved, p.is_saved)),
    createdAt: String(createdAt),
    updatedAt: String(updatedAt),
  };
};

/* ───────── Story ───────── */

export interface MobileStory {
  _id: string;
  author: MobileUser;
  media: { type: 'image' | 'video'; url: string; thumbnail?: string; durationMs?: number } | null;
  text: { content: string } | null;
  audioTrack: { _id: string; title: string; artist: string; audioUrl: string; coverUrl?: string; durationMs: number } | null;
  visibility: 'public' | 'followers' | 'close-friends';
  viewsCount: number;
  likesCount: number;
  reactionsCount: number;
  likedByMe: boolean;
  hasViewed: boolean;
  createdAt: string;
  expiresAt: string;
}

export const mapStory = (s: any): MobileStory => {
  const authorRaw = s.author ?? s.user_id ?? s.user ?? {};
  const createdAt = pick(s.createdAt, s.created_at) ?? new Date().toISOString();
  const rawMedia = Array.isArray(s.media) ? s.media[0] : s.media;
  const captionText = pick(s.text?.content, s.text, s.caption, s.content);
  const durationRaw = Number(pick(rawMedia?.duration, s.duration, s.mediaDuration, s.media_duration) ?? 0);
  const reactions = Array.isArray(s.reactions) ? s.reactions : [];
  return {
    _id: String(pick(s._id, s.id) ?? ''),
    author: mapUser(authorRaw),
    media: rawMedia
      ? {
          type: (rawMedia.type ?? 'image') as 'image' | 'video',
          url: normalizeMediaUrl(rawMedia),
          thumbnail: pick(rawMedia.thumbnail, rawMedia.thumbnail_url) ?? undefined,
          durationMs: durationRaw > 0 ? Math.round(durationRaw * 1000) : undefined,
        }
      : null,
    text: captionText ? { content: String(captionText) } : null,
    audioTrack: (() => {
      const raw = s.audio_track_id ?? s.audioTrack ?? s.audio_track ?? null;
      if (!raw || typeof raw !== 'object') return null;
      return {
        _id: String(raw._id ?? raw.id ?? ''),
        title: String(raw.title ?? 'Unknown'),
        artist: String(raw.artist ?? 'Unknown'),
        audioUrl: String(raw.audio_url ?? raw.audioUrl ?? ''),
        coverUrl: raw.cover_url ?? raw.coverUrl ?? undefined,
        durationMs: Math.round(Number(raw.duration ?? 0) * 1000),
      };
    })(),
    visibility: (s.visibility ?? 'public') as MobileStory['visibility'],
    viewsCount: Number(pick(s.viewsCount, s.views_count, s.view_count, Array.isArray(s.viewers) ? s.viewers.length : 0) ?? 0),
    likesCount: Number(pick(s.likesCount, s.likes_count, reactions.filter((reaction: any) => reaction?.emoji === '❤️').length) ?? 0),
    reactionsCount: Number(pick(s.reactionsCount, s.reactions_count, reactions.length) ?? 0),
    likedByMe: Boolean(pick(s.likedByMe, s.liked_by_me)),
    hasViewed: Boolean(pick(s.hasViewed, s.has_viewed)),
    createdAt: String(createdAt),
    expiresAt: String(pick(s.expiresAt, s.expires_at) ?? createdAt),
  };
};

/* ───────── Comment ───────── */

export interface MobileComment {
  _id: string;
  author: MobileUser;
  content: string;
  contentType: 'post' | 'reel';
  contentId: string;
  parentComment: string | null;
  likesCount: number;
  repliesCount: number;
  isLiked: boolean;
  isEdited: boolean;
  isPinned: boolean;
  createdAt: string;
  replies?: MobileComment[];
}

export const mapComment = (c: any): MobileComment => {
  const authorRaw = c.author ?? c.user_id ?? c.user ?? {};
  const createdAt = pick(c.createdAt, c.created_at) ?? new Date().toISOString();
  return {
    _id: String(pick(c._id, c.id) ?? ''),
    author: mapUser(authorRaw),
    content: c.content ?? c.text ?? '',
    contentType: (pick(c.contentType, c.content_type) ?? 'post') as 'post' | 'reel',
    contentId: String(pick(c.contentId, c.content_id, c.post_id, c.reel_id) ?? ''),
    parentComment: pick(c.parentComment, c.parent_comment_id) ?? null,
    likesCount: Number(pick(c.likesCount, c.likes_count) ?? 0),
    repliesCount: Number(pick(c.repliesCount, c.replies_count) ?? 0),
    isLiked: Boolean(pick(c.isLiked, c.is_liked)),
    isEdited: Boolean(pick(c.isEdited, c.is_edited)),
    isPinned: Boolean(pick(c.isPinned, c.is_pinned)),
    createdAt: String(createdAt),
    replies: Array.isArray(c.replies) ? c.replies.map(mapComment) : undefined,
  };
};

/* ───────── Notification ───────── */

export interface MobileNotification {
  _id: string;
  sender: MobileUser;
  type: string;
  message: string;
  contentType?: string;
  contentId?: string;
  commentId?: string;
  isRead: boolean;
  createdAt: string;
}

export const mapNotification = (n: any): MobileNotification => {
  const sender = n.sender ?? n.sender_id ?? n.from_user ?? {};
  const content = n.content ?? {};
  const resolvedContentType = pick(
    n.contentType,
    n.content_type,
    content.content_type,
    content.target_type,
  );
  const resolvedContentId = pick(
    n.contentId,
    n.content_id,
    content.content_id,
    content.target_id,
  );
  return {
    _id: String(pick(n._id, n.id) ?? ''),
    sender: mapUser(sender),
    type: n.type ?? 'generic',
    message: n.message ?? n.text ?? content.text ?? '',
    contentType: resolvedContentType ? String(resolvedContentType) : undefined,
    contentId: resolvedContentId ? String(resolvedContentId) : undefined,
    commentId: pick(n.commentId, n.comment_id, content.comment_id)
      ? String(pick(n.commentId, n.comment_id, content.comment_id))
      : undefined,
    isRead: Boolean(pick(n.isRead, n.is_read)),
    createdAt: String(pick(n.createdAt, n.created_at) ?? new Date().toISOString()),
  };
};

/* ───────── Chat ───────── */

export interface MobileChatParticipant extends MobileUser {
  lastSeen?: string;
}

export interface MobileChatMessage {
  _id: string;
  sender: MobileUser;
  content: {
    text?: string;
    media?: { type: 'image' | 'video'; url: string; filename?: string };
    sharedContentId?: string;
    sharedContentType?: 'post' | 'reel' | 'story';
    sharedCommentId?: string;
  };
  messageType: 'text' | 'media' | 'system' | 'post_share' | 'reel_share' | 'story_reply';
  readBy: { user: string; readAt: string }[];
  isDeleted: boolean;
  createdAt: string;
}

export interface MobileConversation {
  _id: string;
  participants: MobileChatParticipant[];
  isGroup: boolean;
  groupName?: string;
  lastMessage: MobileChatMessage | null;
  lastActivity: string;
  unreadCount: number;
}

export const mapChatMessage = (m: any): MobileChatMessage => {
  const senderRaw = pick(m.sender, m.sender_id);
  let senderDoc: any = {};
  if (typeof senderRaw === 'string' && senderRaw.length > 0) {
    senderDoc = { _id: senderRaw };
  } else if (senderRaw && typeof senderRaw === 'object' && (senderRaw.username != null || senderRaw.display_name != null)) {
    senderDoc = senderRaw;
  } else if (senderRaw && typeof senderRaw === 'object') {
    senderDoc = { _id: String(pick(senderRaw._id, senderRaw.id) ?? '') };
  }

  const rawContent = m.content ?? {};
  const readSource = Array.isArray(m.read_by) ? m.read_by : Array.isArray(m.readBy) ? m.readBy : [];
  const readBy = readSource.map((r: any) => ({
    user: String(pick(r.user, r.user_id?._id, r.user_id) ?? ''),
    readAt: String(pick(r.readAt, r.read_at) ?? ''),
  }));

  return {
    _id: String(pick(m._id, m.id) ?? ''),
    sender: mapUser(senderDoc),
    content: {
      text: rawContent.text,
      media: rawContent.media
        ? {
            type: rawContent.media.type ?? 'image',
            url: normalizeMediaUrl(rawContent.media),
            filename: rawContent.media.filename,
          }
        : undefined,
      sharedContentId: pick(rawContent.sharedContentId, rawContent.shared_content_id)
        ? String(pick(rawContent.sharedContentId, rawContent.shared_content_id))
        : undefined,
      sharedContentType: pick(rawContent.sharedContentType, rawContent.shared_content_type)
        ? String(pick(rawContent.sharedContentType, rawContent.shared_content_type)) as MobileChatMessage['content']['sharedContentType']
        : undefined,
      sharedCommentId: pick(rawContent.sharedCommentId, rawContent.shared_comment_id)
        ? String(pick(rawContent.sharedCommentId, rawContent.shared_comment_id))
        : undefined,
    },
    messageType: (m.type ?? m.messageType ?? 'text') as MobileChatMessage['messageType'],
    readBy,
    isDeleted: Boolean(pick(m.isDeleted, m.is_deleted)),
    createdAt: String(pick(m.createdAt, m.created_at) ?? new Date().toISOString()),
  };
};

/** Conversation `last_message` is a preview object `{ text, sender_id, sent_at }`, not a full Message. */
const mapConversationLastMessagePreview = (c: any): MobileChatMessage | null => {
  const lm = c.last_message ?? c.lastMessage;
  const text = lm?.text ?? lm?.content?.text;
  if (!lm || text == null || text === '') return null;
  const senderRaw = pick(lm.sender, lm.sender_id);
  const senderForMap =
    typeof senderRaw === 'string' && senderRaw.length > 0
      ? { _id: senderRaw }
      : (senderRaw ?? {});
  return {
    _id: `last-preview-${pick(c._id, c.id)}`,
    sender: mapUser(senderForMap),
    content: { text: String(text) },
    messageType: 'text',
    readBy: [],
    isDeleted: false,
    createdAt: String(pick(lm.sent_at, lm.sentAt, lm.created_at, c.updated_at, c.updatedAt) ?? new Date().toISOString()),
  };
};

export const mapConversation = (c: any): MobileConversation => {
  const participantsRaw = Array.isArray(c.participants) ? c.participants : [];
  return {
    _id: String(pick(c._id, c.id) ?? ''),
    participants: participantsRaw.map((p: any) => mapUser(p.user_id ?? p)) as MobileChatParticipant[],
    isGroup: (c.type ?? 'dm') === 'group' || Boolean(pick(c.isGroup, c.is_group)),
    groupName: pick(c.groupName, c.group_name),
    lastMessage: mapConversationLastMessagePreview(c),
    lastActivity: String(pick(c.lastActivity, c.last_activity, c.updated_at, c.updatedAt) ?? new Date().toISOString()),
    unreadCount: Number(pick(c.unreadCount, c.unread_count) ?? 0),
  };
};

/* ───────── Reel ───────── */

export interface MobileReel {
  _id: string;
  author: MobileUser;
  caption: string;
  video: { url: string; thumbnail: string; width: number; height: number; duration: number };
  audio: { title?: string; artist?: string; originalAudio?: string } | null;
  hashtags: string[];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  allowRemix: boolean;
  isLiked: boolean;
  isSaved: boolean;
  createdAt: string;
}

export const mapReel = (r: any): MobileReel => {
  const authorRaw = r.author ?? r.user_id ?? r.user ?? {};
  const videoRaw = r.video ?? r.video_url ?? {};
  const video = typeof videoRaw === 'string'
    ? { url: videoRaw, thumbnail: r.thumbnail_url ?? r.thumbnailUrl ?? '', width: 1080, height: 1920, duration: r.duration ?? 0 }
    : {
        url: normalizeMediaUrl(videoRaw),
        thumbnail: pick(videoRaw.thumbnail, videoRaw.thumbnail_url, r.thumbnail_url) ?? '',
        width: Number(videoRaw.width ?? 1080),
        height: Number(videoRaw.height ?? 1920),
        duration: Number(videoRaw.duration ?? r.duration ?? 0),
      };
  return {
    _id: String(pick(r._id, r.id) ?? ''),
    author: mapUser(authorRaw),
    caption: pick(r.caption, r.description, r.title) ?? '',
    video,
    audio: r.audio ?? null,
    hashtags: Array.isArray(r.hashtags) ? r.hashtags : [],
    likesCount: Number(pick(r.likesCount, r.likes_count) ?? 0),
    commentsCount: Number(pick(r.commentsCount, r.comments_count) ?? 0),
    sharesCount: Number(pick(r.sharesCount, r.shares_count) ?? 0),
    viewsCount: Number(pick(r.viewsCount, r.views_count) ?? 0),
    allowRemix: Boolean(pick(r.allowRemix, r.allow_remix, true)),
    isLiked: Boolean(pick(r.isLiked, r.is_liked)),
    isSaved: Boolean(pick(r.isSaved, r.is_saved)),
    createdAt: String(pick(r.createdAt, r.created_at) ?? new Date().toISOString()),
  };
};

/* ───────── Pagination helpers ───────── */

/** Convert the shared Paginated<T> shape to the legacy `{posts, hasMore}` style. */
export const toLegacyPage = <T, K extends string>(
  pageKey: K,
  page: Paginated<T>,
  currentPage = 1,
): { [k in K]: T[] } & { hasMore: boolean; page: number; cursor: string | null } => {
  return {
    [pageKey]: page.items,
    hasMore: page.hasMore,
    page: currentPage,
    cursor: page.cursor,
  } as any;
};
