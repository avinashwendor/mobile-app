const APP_SCHEME = 'instayt';

export type ContentTarget = {
  contentType: 'post' | 'reel';
  contentId: string;
  commentId?: string | null;
  openComments?: boolean;
};

type ContentRoute =
  | {
      pathname: '/(screens)/post/[id]';
      params: {
        id: string;
        openComments?: '1';
        commentId?: string;
      };
    }
  | {
      pathname: '/(tabs)/reels';
      params: {
        startReelId: string;
        openComments?: '1';
        commentId?: string;
      };
    };

const buildQueryString = (params: Record<string, string | undefined>) => {
  const query = Object.entries(params)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');

  return query ? `?${query}` : '';
};

export const buildContentRoute = ({ contentType, contentId, commentId, openComments }: ContentTarget): ContentRoute => {
  const shouldOpenComments = openComments || Boolean(commentId);

  if (contentType === 'post') {
    return {
      pathname: '/(screens)/post/[id]',
      params: {
        id: contentId,
        ...(shouldOpenComments ? { openComments: '1' as const } : {}),
        ...(commentId ? { commentId } : {}),
      },
    };
  }

  return {
    pathname: '/(tabs)/reels',
    params: {
      startReelId: contentId,
      ...(shouldOpenComments ? { openComments: '1' as const } : {}),
      ...(commentId ? { commentId } : {}),
    },
  };
};

export const navigateToContent = (
  router: { push: (route: ContentRoute) => void },
  target: ContentTarget,
) => {
  router.push(buildContentRoute(target));
};

export const buildContentDeepLink = ({ contentType, contentId, commentId, openComments }: ContentTarget): string => {
  const shouldOpenComments = openComments || Boolean(commentId);

  if (contentType === 'post') {
    return `${APP_SCHEME}://post/${encodeURIComponent(contentId)}${buildQueryString({
      ...(shouldOpenComments ? { openComments: '1' } : {}),
      ...(commentId ? { commentId } : {}),
    })}`;
  }

  return `${APP_SCHEME}://reels${buildQueryString({
    startReelId: contentId,
    ...(shouldOpenComments ? { openComments: '1' } : {}),
    ...(commentId ? { commentId } : {}),
  })}`;
};

export const buildContentShareMessage = ({
  contentType,
  contentId,
  commentId,
  openComments,
  headline,
}: ContentTarget & { headline?: string }) => {
  const message = headline || `Check out this ${contentType} on INSTAYT!`;
  const link = buildContentDeepLink({ contentType, contentId, commentId, openComments });
  return `${message}\n${link}`;
};