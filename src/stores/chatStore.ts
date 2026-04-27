import { create } from 'zustand';
import * as chatApi from '../api/chat.api';
import { mapChatMessage } from '../api/adapters';
import { socketService } from '../services/socketService';
import type { Conversation, ChatMessage } from '../api/chat.api';

interface ChatState {
  conversations: Conversation[];
  unreadDmCount: number;
  isLoading: boolean;

  /** Load the conversation list from the backend */
  fetchConversations: () => Promise<void>;

  /** Called from _layout when socket fires new_message */
  handleIncomingMessage: (payload: any, currentUserId: string) => void;

  /** Mark a conversation as fully read (reset its unreadCount) */
  markConversationRead: (conversationId: string) => void;

  /** Prepend a conversation to the top (after creation) */
  prependConversation: (conv: Conversation) => void;

  /** Replace an optimistic / stale last-message preview */
  updateConversationLastMessage: (conversationId: string, message: ChatMessage) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  unreadDmCount: 0,
  isLoading: false,

  fetchConversations: async () => {
    set({ isLoading: true });
    try {
      const { conversations } = await chatApi.getConversations(1, 50);
      const unread = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
      set({ conversations, unreadDmCount: unread });
    } catch (err) {
      console.error('[chatStore] fetchConversations error:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  handleIncomingMessage: (payload: any, currentUserId: string) => {
    const convId: string = payload.conversation_id ?? payload.conversationId ?? '';
    const rawMsg = payload.message ?? payload;
    const message = mapChatMessage(rawMsg);

    set((state) => {
      const existing = state.conversations.find((c) => c._id === convId);
      const isFromMe = message.sender?._id === currentUserId;

      const updated = state.conversations.map((c) => {
        if (c._id !== convId) return c;
        return {
          ...c,
          lastMessage: message,
          lastActivity: message.createdAt,
          unreadCount: isFromMe ? c.unreadCount : c.unreadCount + 1,
        };
      });

      // Sort so most recent conversation floats to the top
      updated.sort(
        (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );

      const unreadDelta = !isFromMe && existing ? 1 : 0;

      return {
        conversations: updated,
        unreadDmCount: Math.max(0, state.unreadDmCount + unreadDelta),
      };
    });
  },

  markConversationRead: (conversationId: string) => {
    set((state) => {
      const conv = state.conversations.find((c) => c._id === conversationId);
      const wasUnread = conv?.unreadCount ?? 0;
      return {
        conversations: state.conversations.map((c) =>
          c._id === conversationId ? { ...c, unreadCount: 0 } : c
        ),
        unreadDmCount: Math.max(0, state.unreadDmCount - wasUnread),
      };
    });
  },

  prependConversation: (conv: Conversation) => {
    set((state) => ({
      conversations: [conv, ...state.conversations.filter((c) => c._id !== conv._id)],
    }));
  },

  updateConversationLastMessage: (conversationId: string, message: ChatMessage) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c._id === conversationId
          ? { ...c, lastMessage: message, lastActivity: message.createdAt }
          : c
      ),
    }));
  },
}));

/**
 * Subscribe to new_message WebSocket events and push them into the store.
 * Call once after the user is authenticated (from _layout AuthGate).
 * Returns an unsubscribe function.
 */
export function subscribeChatSocket(currentUserId: string): () => void {
  return socketService.on('new_message', (payload: any) => {
    useChatStore.getState().handleIncomingMessage(payload, currentUserId);
  });
}
