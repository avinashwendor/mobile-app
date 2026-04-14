/**
 * App-wide constants — must stay in sync with the backend at
 * /Users/apple/Desktop/insta-project/backend
 */

/** Backend runs on port 3000, routes are under /api (no /v1 prefix) */
export const API_BASE_URL = 'http://localhost:3000/api';

/** WebSocket endpoint for real-time events */
export const WS_URL = 'http://localhost:3000';

export const NOTIFICATION_TYPES = {
  LIKE: 'like',
  COMMENT: 'comment',
  COMMENT_REPLY: 'comment_reply',
  FOLLOW: 'follow',
  FOLLOW_REQUEST: 'follow_request',
  FOLLOW_ACCEPT: 'follow_accept',
  MENTION: 'mention',
} as const;

/** Keys for AsyncStorage persistence */
export const STORAGE_KEYS = {
  TOKEN: '@instayt/token',
  USER: '@instayt/user',
  THEME_MODE: '@instayt/theme_mode',
} as const;

/** Pagination defaults matching backend query defaults */
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  FEED_LIMIT: 10,
  COMMENTS_LIMIT: 20,
  MESSAGES_LIMIT: 50,
} as const;
