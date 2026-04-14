import { create } from 'zustand';
import * as notifApi from '../api/notification.api';

interface NotificationState {
  unreadCount: number;

  /** Fetch the current unread count from the backend */
  fetchUnreadCount: () => Promise<void>;

  /** Increment locally (e.g. on WebSocket push) */
  increment: () => void;

  /** Decrement locally after marking one as read */
  decrement: () => void;

  /** Reset to zero after mark-all-as-read */
  clearCount: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,

  fetchUnreadCount: async () => {
    try {
      const { unreadCount } = await notifApi.getNotifications(1, 1);
      set({ unreadCount });
    } catch {
      // Non-critical — silently ignore
    }
  },

  increment: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  decrement: () => set((s) => ({ unreadCount: Math.max(0, s.unreadCount - 1) })),
  clearCount: () => set({ unreadCount: 0 }),
}));
