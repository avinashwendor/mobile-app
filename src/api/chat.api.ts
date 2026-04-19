import apiClient from './client';
import {
  mapChatMessage,
  mapConversation,
  unwrap,
  type MobileChatMessage,
  type MobileConversation,
  type MobileChatParticipant,
} from './adapters';

/**
 * Chat API — conversations, messages, and read-receipts live under
 * `/chat/conversations`. Messages are sent with a `content` wrapper
 * object (text / shared_content / font preferences).
 */

export type ChatParticipant = MobileChatParticipant;
export type ChatMessage = MobileChatMessage;
export type Conversation = MobileConversation;

export async function getConversations(
  _page = 1,
  limit = 20,
): Promise<{ conversations: Conversation[]; hasMore: boolean }> {
  const { data } = await apiClient.get('/chat/conversations', { params: { limit } });
  const list = Array.isArray(data.data) ? data.data : [];
  return {
    conversations: list.map(mapConversation),
    hasMore: Boolean(data.meta?.has_more),
  };
}

export async function createConversation(
  participantIds: string[],
  isGroup = false,
  groupName?: string,
): Promise<Conversation> {
  const ids = participantIds.map((id) => String(id).trim()).filter(Boolean);
  const res = await apiClient.post('/chat/conversations', {
    type: isGroup ? 'group' : 'dm',
    participant_ids: ids,
    group_name: groupName,
  });
  return mapConversation(unwrap<any>(res));
}

export async function getMessages(
  conversationId: string,
  _page = 1,
  limit = 50,
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  const { data } = await apiClient.get(`/chat/conversations/${conversationId}/messages`, {
    params: { limit },
  });
  const list = Array.isArray(data.data) ? data.data : [];
  return {
    messages: list.map(mapChatMessage),
    hasMore: Boolean(data.meta?.has_more),
  };
}

export async function sendMessage(conversationId: string, text: string): Promise<ChatMessage> {
  const res = await apiClient.post(`/chat/conversations/${conversationId}/messages`, {
    type: 'text',
    content: { text },
  });
  return mapChatMessage(unwrap<any>(res));
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await apiClient.post(`/chat/conversations/${conversationId}/read`, {});
}

export async function markMessageRead(conversationId: string, _messageId: string): Promise<void> {
  // Backend exposes per-conversation read, not per-message.
  await markConversationRead(conversationId);
}

export async function deleteMessage(conversationId: string, messageId: string): Promise<void> {
  await apiClient.delete(`/chat/conversations/${conversationId}/messages/${messageId}`);
}
