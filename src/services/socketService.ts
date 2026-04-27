import { io, Socket } from 'socket.io-client';
import { WS_URL, STORAGE_KEYS } from '../utils/constants';
import { getItem } from '../utils/storage';

/**
 * Real-time WebSocket service using Socket.IO.
 *
 * Connects to the backend WS server at WS_URL with JWT authentication.
 * Dispatches events for:
 * - Chat: new_message, user_typing, user_stopped_typing, user_online/offline
 * - Notifications: new_notification
 *
 * Usage:
 *   await socketService.connect();
 *   socketService.on('new_message', handler);
 *   socketService.joinConversation(convId);
 */

type EventHandler = (...args: any[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventHandler>> = new Map();

  /** Whether the socket is currently connected */
  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /** Connect to the WS server with the stored JWT token */
  async connect(): Promise<void> {
    if (this.socket?.connected) return;

    const token = await getItem(STORAGE_KEYS.TOKEN);
    if (!token) return;

    this.socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 10_000,
    });

    this.socket.on('connect', () => {
      console.log('[WS] Connected:', this.socket?.id);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[WS] Connection error:', err.message);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
    });

    // Re-register all existing listeners on the new socket
    for (const [event, handlers] of this.listeners) {
      for (const handler of handlers) {
        this.socket.on(event, handler);
      }
    }
  }

  /** Disconnect and clean up */
  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  /** Subscribe to an event. Returns unsubscribe function. */
  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    this.socket?.on(event, handler);

    return () => {
      this.listeners.get(event)?.delete(handler);
      this.socket?.off(event, handler);
    };
  }

  /** Emit an event to the server */
  emit(event: string, data?: any): void {
    this.socket?.emit(event, data);
  }

  // ─── Chat Helpers ─────────────────────────────────────

  joinConversation(conversationId: string): void {
    this.emit('join_conversation', { conversation_id: conversationId });
  }

  leaveConversation(conversationId: string): void {
    this.emit('leave_conversation', { conversation_id: conversationId });
  }

  startTyping(conversationId: string): void {
    this.emit('typing_start', { conversation_id: conversationId });
  }

  stopTyping(conversationId: string): void {
    this.emit('typing_stop', { conversation_id: conversationId });
  }

  // ─── Server Channel Helpers ───────────────────────────

  joinChannel(channelId: string): void {
    this.emit('join_channel', { channel_id: channelId });
  }

  leaveChannel(channelId: string): void {
    this.emit('leave_channel', { channel_id: channelId });
  }

  joinContent(contentType: 'post' | 'reel', contentId: string): void {
    this.emit('join_content', { content_type: contentType, content_id: contentId });
  }

  leaveContent(contentType: 'post' | 'reel', contentId: string): void {
    this.emit('leave_content', { content_type: contentType, content_id: contentId });
  }
}

/** Singleton instance — import and use across the app */
export const socketService = new SocketService();
