import type { Conversation } from '../api/chat.api';

/**
 * Collapse duplicate 1:1 DM rows that point at the same other user (keeps the most recently active).
 * Group chats are left as-is.
 */
export function dedupeDmConversations(
  conversations: Conversation[],
  currentUserId: string | null | undefined,
): Conversation[] {
  if (!currentUserId) return conversations;

  const groups = conversations.filter((c) => c.isGroup);
  const dms = conversations.filter((c) => !c.isGroup);

  const bestByOther = new Map<string, Conversation>();
  for (const c of dms) {
    const other = c.participants.find((p) => p._id !== currentUserId);
    const key = other?._id ?? c._id;
    const prev = bestByOther.get(key);
    const t = (x: Conversation) => new Date(x.lastActivity || 0).getTime();
    if (!prev || t(c) > t(prev)) {
      bestByOther.set(key, c);
    }
  }

  const merged = [...groups, ...bestByOther.values()];
  return merged.sort((a, b) => new Date(b.lastActivity || 0).getTime() - new Date(a.lastActivity || 0).getTime());
}
