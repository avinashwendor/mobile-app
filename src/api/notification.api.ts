import apiClient from './client';
import { getDummyNotifications } from '../data/dummyData';

/* ───────── Types ───────── */

export interface Notification {
  _id: string;
  sender: {
    _id: string;
    username: string;
    fullName: string;
    profilePicture: string;
    isVerified: boolean;
  };
  type: string;
  message: string;
  contentType?: string;
  contentId?: string;
  isRead: boolean;
  createdAt: string;
}

/* ───────── API Calls ───────── */

/** GET /notifications?page=&limit=&type= */
export async function getNotifications(
  page = 1,
  limit = 20,
  type?: string,
): Promise<{ notifications: Notification[]; unreadCount: number; hasMore: boolean }> {
  try {
    const { data } = await apiClient.get('/notifications', { params: { page, limit, type } });
    return {
      notifications: data.data.notifications,
      unreadCount: data.data.unreadCount,
      hasMore: data.data.pagination.hasMore,
    };
  } catch {
    return getDummyNotifications(page, limit);
  }
}

/** PUT /notifications/:notificationId/read */
export async function markRead(notificationId: string): Promise<void> {
  try {
    await apiClient.put(`/notifications/${notificationId}/read`);
  } catch {
    // Silently succeed offline
  }
}

/** PUT /notifications/read-all */
export async function markAllRead(): Promise<void> {
  try {
    await apiClient.put('/notifications/read-all');
  } catch {
    // Silently succeed offline
  }
}

/** DELETE /notifications/:notificationId */
export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    await apiClient.delete(`/notifications/${notificationId}`);
  } catch {
    // Silently succeed offline
  }
}
