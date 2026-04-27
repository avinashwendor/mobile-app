import apiClient from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalyticsRow {
  date: string;
  profile_visits?: number;
  impressions?: number;
  reach?: number;
  engagement?: {
    likes_received?: number;
    comments_received?: number;
    shares_received?: number;
    saves_received?: number;
  };
  followers_gained?: number;
  followers_lost?: number;
  story_views?: number;
  reel_views?: number;
  ad_earnings?: number;
}

export interface ContentInsightsTotals {
  views: number;
  unique_views: number;
  avg_watch_time: number;
  completion_rate: number;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  };
  traffic_sources: {
    feed: number;
    explore: number;
    profile: number;
    hashtag: number;
    external: number;
  };
}

export interface ContentInsights {
  totals: ContentInsightsTotals;
  engagementRate: number;
  dailyRows: Array<ContentInsightsTotals & { date: string }>;
}

export interface TopContentItem {
  contentType: 'post' | 'reel';
  contentId: string;
  views: number;
  likes: number;
  thumbnailUrl: string | null;
  caption: string;
}

export interface ProfileSummary {
  user: {
    username: string;
    followersCount: number;
    followingCount: number;
    postsCount: number;
  };
  topContent: TopContentItem[];
  last30Days: {
    impressions: number;
    reach: number;
    profile_visits: number;
    followers_gained: number;
    followers_lost: number;
  };
  last7Days: {
    impressions: number;
    reach: number;
    profile_visits: number;
    followers_gained: number;
    followers_lost: number;
  };
}

// ─── API calls ────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

export const analyticsApi = {
  getMyAnalytics: async (windowDays = 30): Promise<AnalyticsRow[]> => {
    const { data } = await apiClient.get<{ success: boolean; data: AnalyticsRow[] }>('/analytics/me', {
      params: {
        start_date: new Date(Date.now() - windowDays * DAY_MS).toISOString(),
        end_date: new Date().toISOString(),
      },
    });
    return Array.isArray(data.data) ? data.data : [];
  },

  getProfileSummary: async (): Promise<ProfileSummary | null> => {
    const { data } = await apiClient.get<{ success: boolean; data: ProfileSummary }>('/analytics/profile/summary');
    return data.data ?? null;
  },

  getContentInsights: async (contentType: 'post' | 'reel' | 'story', contentId: string): Promise<ContentInsights> => {
    const { data } = await apiClient.get<{ success: boolean; data: ContentInsights }>(
      `/analytics/content/${contentType}/${contentId}/insights`
    );
    return data.data;
  },

  recordWatch: async (payload: {
    content_type: 'post' | 'reel' | 'story';
    content_id: string;
    watch_duration: number;
    completed?: boolean;
  }): Promise<void> => {
    await apiClient.post('/analytics/watch', payload);
  },
};

export default analyticsApi;
