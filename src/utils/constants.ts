import Constants from 'expo-constants';

/**
 * App-wide constants kept in sync with the INSTAYT backend.
 *
 * The backend serves its API under `/api/v1` on port 3000 and exposes a
 * Socket.IO endpoint on the same host. In development we derive the host
 * automatically from the Expo bundler so the app works on simulators and
 * real devices on the same LAN without any manual IP changes.
 */

const DEFAULT_DEV_PORT = 3000;

const resolveDevHost = (): string => {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any).expoGoConfig?.debuggerHost ??
    (Constants as any).manifest?.debuggerHost;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host !== '127.0.0.1') return host;
  }
  return 'localhost';
};

const host = resolveDevHost();

/** Base URL for REST requests — mounts under `/api/v1` on the backend */
export const API_BASE_URL = `http://Insta-app-backend-env.eba-7c2tbppk.us-east-1.elasticbeanstalk.com/api/v1`;
// export const API_BASE_URL = `http://${`192.168.0.228`}:${DEFAULT_DEV_PORT}/api/v1`;
/** WebSocket endpoint served by the same HTTP server (Socket.IO) */
// export const WS_URL = `http://${`192.168.0.228`}:${DEFAULT_DEV_PORT}`;
export const WS_URL = `http://Insta-app-backend-env.eba-7c2tbppk.us-east-1.elasticbeanstalk.com`;

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
  REFRESH_TOKEN: '@instayt/refresh_token',
  PUSH_TOKEN: '@instayt/push_token',
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
