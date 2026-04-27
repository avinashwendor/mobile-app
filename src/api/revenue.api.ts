import apiClient from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RevenueSummary {
  total: number;
  thisMonth: number;
  lastMonth: number;
  pending: number;
  available: number;
  breakdown: Array<{
    source: string;
    amount: number;
    percentage: number;
  }>;
}

export interface DailyRevenueRow {
  date: string;
  earnings: number;
  impressions: number;
}

export type PayoutMethod = 'bank_transfer' | 'paypal' | 'wallet';
export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface BankDetails {
  account_name?: string;
  account_number?: string;
  routing_number?: string;
  bank_name?: string;
}

export interface PayoutRequest {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  method: PayoutMethod;
  bank_details?: BankDetails;
  paypal_email?: string;
  status: PayoutStatus;
  notes?: string;
  requested_at: string;
  processed_at?: string;
}

export interface PayoutSettings {
  user_id?: string;
  preferred_method: PayoutMethod;
  bank_details: BankDetails | null;
  paypal_email?: string | null;
  minimum_payout_threshold: number;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const revenueApi = {
  getSummary: async (): Promise<RevenueSummary> => {
    const { data } = await apiClient.get<{ success: boolean; data: RevenueSummary }>('/revenue/summary');
    return data.data;
  },

  getDaily: async (windowDays = 30): Promise<DailyRevenueRow[]> => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const { data } = await apiClient.get<{ success: boolean; data: DailyRevenueRow[] }>('/revenue/daily', {
      params: {
        start_date: new Date(Date.now() - windowDays * DAY_MS).toISOString(),
        end_date: new Date().toISOString(),
      },
    });
    return Array.isArray(data.data) ? data.data : [];
  },

  requestPayout: async (payload: {
    amount: number;
    method: PayoutMethod;
    bank_details?: BankDetails;
    paypal_email?: string;
  }): Promise<PayoutRequest> => {
    const { data } = await apiClient.post<{ success: boolean; data: PayoutRequest }>(
      '/revenue/payout/request',
      payload
    );
    return data.data;
  },

  getPayoutHistory: async (): Promise<PayoutRequest[]> => {
    const { data } = await apiClient.get<{ success: boolean; data: PayoutRequest[] }>(
      '/revenue/payout/history',
      { params: { limit: 50 } }
    );
    return Array.isArray(data.data) ? data.data : [];
  },

  getPayoutSettings: async (): Promise<PayoutSettings> => {
    const { data } = await apiClient.get<{ success: boolean; data: PayoutSettings }>('/revenue/payout/settings');
    return data.data;
  },

  updatePayoutSettings: async (payload: Partial<PayoutSettings>): Promise<PayoutSettings> => {
    const { data } = await apiClient.put<{ success: boolean; data: PayoutSettings }>(
      '/revenue/payout/settings',
      payload
    );
    return data.data;
  },
};

export default revenueApi;
