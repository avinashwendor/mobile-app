import apiClient from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdStatus = 'draft' | 'pending_review' | 'active' | 'paused' | 'completed' | 'rejected';
export type AdObjective = 'awareness' | 'engagement' | 'conversions';
export type AdType = 'banner' | 'interstitial' | 'native' | 'sponsored_post' | 'sponsored_reel';
export type BidType = 'cpm' | 'cpc' | 'cpa';
export type ContentSource = 'existing_post' | 'existing_reel' | 'uploaded_media';

export interface TargetAudience {
  age_range?: { min: number; max: number };
  genders?: string[];
  locations?: string[];
  interests?: string[];
}

export interface AdBudget {
  total?: number;
  daily_limit?: number;
  bid_type: BidType;
  bid_amount: number;
}

export interface AdSchedule {
  start_date: string;
  end_date: string;
}

export interface AdCreativeData {
  media_url?: string;
  caption?: string;
  cta_text?: string;
  cta_url?: string;
}

export interface AdCampaign {
  id: string;
  name: string;
  objective: AdObjective;
  type: AdType;
  status: AdStatus;
  target_audience?: TargetAudience;
  budget: AdBudget;
  schedule: AdSchedule;
  creative?: AdCreativeData;
  rejection_reason?: string;
  metrics: {
    impressions: number;
    clicks: number;
    spend: number;
  };
  created_at: string;
}

export interface AdSet {
  id: string;
  campaign_id: string;
  name: string;
  target_audience?: TargetAudience;
  budget?: { daily_limit: number; bid_type: BidType; bid_amount: number };
  schedule?: { start_date?: string; end_date?: string };
  status: 'active' | 'paused' | 'completed';
  metrics: { impressions: number; clicks: number; spend: number };
  created_at: string;
}

export interface AdCreative {
  id: string;
  ad_set_id: string;
  campaign_id: string;
  content_source: ContentSource;
  content_id?: string;
  media_url?: string;
  thumbnail_url?: string;
  caption?: string;
  cta_text?: string;
  cta_url?: string;
  status: 'active' | 'paused';
  created_at: string;
}

export interface CampaignStats {
  campaign: AdCampaign;
  adSets: AdSet[];
  creatives: AdCreative[];
  stats: {
    impressions: number;
    clicks: number;
    spend: number;
    ctr: number;
    cpm: number;
  };
}

export interface CreateCampaignPayload {
  name: string;
  objective: AdObjective;
  type: AdType;
  target_audience?: TargetAudience;
  budget: AdBudget & { total: number };
  schedule: AdSchedule;
  creative?: AdCreativeData;
}

export interface CreateAdSetPayload {
  name: string;
  target_audience?: TargetAudience;
  budget?: { daily_limit?: number; bid_type?: BidType; bid_amount?: number };
  schedule?: { start_date?: string; end_date?: string };
}

export interface CreateCreativePayload {
  content_source: ContentSource;
  content_id?: string;
  media_url?: string;
  thumbnail_url?: string;
  caption?: string;
  cta_text?: string;
  cta_url?: string;
}

export interface AdEarning {
  id: string;
  content_type?: string;
  period?: string;
  impressions: number;
  earnings: number;
  currency: string;
  is_paid: boolean;
  paid_at?: string;
  created_at: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const adApi = {
  // Campaigns
  createCampaign: async (payload: CreateCampaignPayload): Promise<AdCampaign> => {
    const { data } = await apiClient.post<{ success: boolean; data: AdCampaign }>('/ads/campaigns', payload);
    return data.data;
  },

  getMyCampaigns: async (): Promise<AdCampaign[]> => {
    const { data } = await apiClient.get<{ success: boolean; data: AdCampaign[] }>('/ads/campaigns');
    return Array.isArray(data.data) ? data.data : [];
  },

  getCampaign: async (campaignId: string): Promise<AdCampaign> => {
    const { data } = await apiClient.get<{ success: boolean; data: AdCampaign }>(`/ads/campaigns/${campaignId}`);
    return data.data;
  },

  getCampaignStats: async (campaignId: string): Promise<CampaignStats> => {
    const { data } = await apiClient.get<{ success: boolean; data: CampaignStats }>(`/ads/campaigns/${campaignId}/stats`);
    return data.data;
  },

  updateStatus: async (campaignId: string, status: 'active' | 'paused'): Promise<AdCampaign> => {
    const { data } = await apiClient.put<{ success: boolean; data: AdCampaign }>(
      `/ads/campaigns/${campaignId}/status`,
      { status }
    );
    return data.data;
  },

  submitForReview: async (campaignId: string): Promise<AdCampaign> => {
    const { data } = await apiClient.post<{ success: boolean; data: AdCampaign }>(
      `/ads/campaigns/${campaignId}/submit`
    );
    return data.data;
  },

  deleteCampaign: async (campaignId: string): Promise<void> => {
    await apiClient.delete(`/ads/campaigns/${campaignId}`);
  },

  // Ad Sets
  createAdSet: async (campaignId: string, payload: CreateAdSetPayload): Promise<AdSet> => {
    const { data } = await apiClient.post<{ success: boolean; data: AdSet }>(
      `/ads/campaigns/${campaignId}/ad-sets`,
      payload
    );
    return data.data;
  },

  getAdSets: async (campaignId: string): Promise<AdSet[]> => {
    const { data } = await apiClient.get<{ success: boolean; data: AdSet[] }>(
      `/ads/campaigns/${campaignId}/ad-sets`
    );
    return Array.isArray(data.data) ? data.data : [];
  },

  // Creatives
  createCreative: async (adSetId: string, payload: CreateCreativePayload): Promise<AdCreative> => {
    const { data } = await apiClient.post<{ success: boolean; data: AdCreative }>(
      `/ads/ad-sets/${adSetId}/creatives`,
      payload
    );
    return data.data;
  },

  getCreatives: async (adSetId: string): Promise<AdCreative[]> => {
    const { data } = await apiClient.get<{ success: boolean; data: AdCreative[] }>(
      `/ads/ad-sets/${adSetId}/creatives`
    );
    return Array.isArray(data.data) ? data.data : [];
  },

  // Impressions
  recordImpression: async (payload: {
    campaign_id: string;
    ad_set_id?: string;
    creative_id?: string;
    event_type: 'impression' | 'click' | 'conversion';
    placement?: 'feed' | 'stories' | 'reels' | 'explore';
  }): Promise<void> => {
    await apiClient.post('/ads/impressions', payload);
  },

  // Earnings
  getMyEarnings: async (): Promise<AdEarning[]> => {
    const { data } = await apiClient.get<{ success: boolean; data: AdEarning[] }>('/ads/earnings', {
      params: { limit: 50 },
    });
    return Array.isArray(data.data) ? data.data : [];
  },
};

export default adApi;
