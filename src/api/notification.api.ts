import apiClient from './client';
import { mapNotification, type MobileNotification } from './adapters';

/**
 * Notification API — backend mounts under `/notifications`.
 * Unread count is served from a separate endpoint; we fetch it in parallel
 * with the list for feed loads.
 */

export type Notification = MobileNotification;

const pageState = new Map<string, string | null>();

export async function getNotifications(
  page = 1,
  limit = 20,
  _type?: string,
): Promise<{ notifications: Notification[]; unreadCount: number; hasMore: boolean }> {
  const cursor = page === 1 ? undefined : pageState.get('notifications') ?? undefined;
  const [listRes, unreadRes] = await Promise.all([
    apiClient.get('/notifications', { params: { cursor, limit } }),
    apiClient.get('/notifications/unread-count').catch(() => null),
  ]);
  const items: any[] = Array.isArray(listRes.data.data) ? listRes.data.data : [];
  pageState.set('notifications', listRes.data.meta?.cursor ?? null);

  return {
    notifications: items.map(mapNotification),
    unreadCount: Number(unreadRes?.data?.data?.unread_count ?? 0),
    hasMore: Boolean(listRes.data.meta?.has_more),
  };
}

export async function markRead(notificationId: string): Promise<void> {
  await apiClient.put(`/notifications/${notificationId}/read`);
}

export async function markAllRead(): Promise<void> {
  await apiClient.put('/notifications/read-all');
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await apiClient.delete(`/notifications/${notificationId}`);
}

export async function registerPushToken(
  token: string,
  platform: 'ios' | 'android',
  deviceName?: string,
): Promise<void> {
  await apiClient.put('/notifications/push-token', {
    token,
    platform,
    device_name: deviceName,
  });
}

export async function unregisterPushToken(token: string): Promise<void> {
  await apiClient.delete('/notifications/push-token', {
    data: { token },
  });
}
