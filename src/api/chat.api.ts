import apiClient from './client';
import type { PostAuthor } from './post.api';
import { getDummyConversations, getDummyMessages, DUMMY_CONVERSATIONS } from '../data/dummyData';

/* ───────── Types ───────── */

export interface ChatParticipant {
  _id: string;
  username: string;
  fullName: string;
  profilePicture: string;
  isVerified: boolean;
  lastSeen?: string;
}

export interface ChatMessage {
  _id: string;
  sender: { _id: string; username: string; fullName: string; profilePicture: string };
  content: {
    text?: string;
    media?: { type: 'image' | 'video'; url: string; filename: string };
  };
  messageType: 'text' | 'media' | 'system';
  readBy: { user: string; readAt: string }[];
  isDeleted: boolean;
  createdAt: string;
}

export interface Conversation {
  _id: string;
  participants: ChatParticipant[];
  isGroup: boolean;
  groupName?: string;
  lastMessage: ChatMessage | null;
  lastActivity: string;
  unreadCount: number;
}

/* ───────── API Calls ───────── */

/** GET /chat/conversations?page=&limit= */
export async function getConversations(
  page = 1,
  limit = 20,
): Promise<{ conversations: Conversation[]; hasMore: boolean }> {
  try {
    const { data } = await apiClient.get('/chat/conversations', { params: { page, limit } });
    return { conversations: data.data.conversations, hasMore: data.data.pagination.hasMore };
  } catch {
    return getDummyConversations();
  }
}

/** POST /chat/conversations — create or find existing 1-on-1 chat */
export async function createConversation(
  participantIds: string[],
  isGroup = false,
  groupName?: string,
): Promise<Conversation> {
  try {
    const { data } = await apiClient.post('/chat/conversations', {
      participants: participantIds,
      isGroup,
      groupName,
    });
    return data.data.conversation;
  } catch {
    return DUMMY_CONVERSATIONS[0];
  }
}

/** GET /chat/conversations/:conversationId/messages?page=&limit= */
export async function getMessages(
  conversationId: string,
  page = 1,
  limit = 50,
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  try {
    const { data } = await apiClient.get(`/chat/conversations/${conversationId}/messages`, {
      params: { page, limit },
    });
    return { messages: data.data.messages, hasMore: data.data.pagination.hasMore };
  } catch {
    return getDummyMessages(conversationId);
  }
}

/** POST /chat/conversations/:conversationId/messages — send message */
export async function sendMessage(
  conversationId: string,
  text: string,
): Promise<ChatMessage> {
  try {
    const { data } = await apiClient.post(`/chat/conversations/${conversationId}/messages`, { text });
    return data.data.message;
  } catch {
    // Return optimistic message so offline sending appears to work
    return {
      _id: `msg_offline_${Date.now()}`,
      sender: { _id: 'demo_user_001', username: 'alex.creates', fullName: 'Alex Morgan', profilePicture: '' },
      content: { text },
      messageType: 'text',
      readBy: [],
      isDeleted: false,
      createdAt: new Date().toISOString(),
    };
  }
}

/** PUT /chat/conversations/:cid/messages/:mid/read — mark as read */
export async function markMessageRead(conversationId: string, messageId: string): Promise<void> {
  try {
    await apiClient.put(`/chat/conversations/${conversationId}/messages/${messageId}/read`);
  } catch {
    // Silently succeed offline
  }
}

/** DELETE /chat/conversations/:cid/messages/:mid */
export async function deleteMessage(conversationId: string, messageId: string): Promise<void> {
  try {
    await apiClient.delete(`/chat/conversations/${conversationId}/messages/${messageId}`);
  } catch {
    // Silently succeed offline
  }
}
