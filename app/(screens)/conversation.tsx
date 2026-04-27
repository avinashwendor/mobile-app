import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../src/theme/tokens';
import UserAvatar from '../../src/components/UserAvatar';
import { useAuthStore } from '../../src/stores/authStore';
import { useChatStore } from '../../src/stores/chatStore';
import { socketService } from '../../src/services/socketService';
import * as chatApi from '../../src/api/chat.api';
import { formatMessageTime } from '../../src/utils/formatters';
import type { ChatMessage } from '../../src/api/chat.api';

const TYPING_DEBOUNCE_MS = 1500;

export default function ConversationScreen() {
  const { convId, title } = useLocalSearchParams<{ convId: string; title: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const user = useAuthStore((s) => s.user);
  const markConversationRead = useChatStore((s) => s.markConversationRead);
  const updateConversationLastMessage = useChatStore((s) => s.updateConversationLastMessage);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [text, setText] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef = useRef<FlatList>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const knownIdsRef = useRef(new Set<string>());

  // ─── Load initial messages ───────────────────────────────────
  useEffect(() => {
    if (!convId) return;

    (async () => {
      try {
        const { messages: initial, hasMore: more } = await chatApi.getMessages(convId, 1, 50);
        setMessages(initial);
        initial.forEach((m) => knownIdsRef.current.add(m._id));
        setHasMore(more);
      } catch (err) {
        console.error('[conversation] load messages error:', err);
      } finally {
        setIsLoading(false);
      }
    })();

    // Mark read on entry
    chatApi.markAsRead(convId).catch(() => {});
    markConversationRead(convId);
  }, [convId, markConversationRead]);

  // ─── Socket: join room & listen ──────────────────────────────
  useEffect(() => {
    if (!convId) return;

    socketService.joinConversation(convId);

    const unsubMessage = socketService.on('new_message', (payload: any) => {
      const convIdFromPayload: string =
        payload.conversation_id ?? payload.conversationId ?? '';
      if (convIdFromPayload !== convId) return;

      // The payload.message is already serialized by the backend chat controller
      const raw = payload.message ?? payload;
      // Map to our type via the API adapter (reuse)
      import('../../src/api/adapters').then(({ mapChatMessage }) => {
        const incoming = mapChatMessage(raw);
        if (knownIdsRef.current.has(incoming._id)) return;
        knownIdsRef.current.add(incoming._id);

        setMessages((prev) => [incoming, ...prev]);
        updateConversationLastMessage(convId, incoming);

        // Mark as read immediately since this screen is open
        chatApi.markAsRead(convId).catch(() => {});
        markConversationRead(convId);
      });
    });

    const unsubTypingStart = socketService.on(
      'user_typing',
      (payload: { user_id: string; username: string }) => {
        if (payload.user_id === user?._id) return;
        setTypingUsers((prev) =>
          prev.includes(payload.username) ? prev : [...prev, payload.username]
        );
      }
    );

    const unsubTypingStop = socketService.on(
      'user_stopped_typing',
      (payload: { user_id: string }) => {
        setTypingUsers((prev) => {
          // We only have username in typing list; remove any entry if user_id matches
          // Re-fetch via a full clear — simplest and correct
          return prev.filter((_, i) => i !== prev.length - 1 || payload.user_id !== user?._id);
        });
        // Simpler: just clear on stop since we only care about "someone is typing"
        setTypingUsers([]);
      }
    );

    return () => {
      socketService.leaveConversation(convId);
      unsubMessage();
      unsubTypingStart();
      unsubTypingStop();
    };
  }, [convId, markConversationRead, updateConversationLastMessage, user?._id]);

  // ─── Load older messages ─────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || !convId) return;
    setIsLoadingMore(true);
    try {
      const nextPage = Math.ceil(messages.length / 50) + 1;
      const { messages: older, hasMore: more } = await chatApi.getMessages(convId, nextPage, 50);
      const fresh = older.filter((m) => !knownIdsRef.current.has(m._id));
      fresh.forEach((m) => knownIdsRef.current.add(m._id));
      setMessages((prev) => [...prev, ...fresh]);
      setHasMore(more);
    } catch (err) {
      console.error('[conversation] loadMore error:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [convId, hasMore, isLoadingMore, messages.length]);

  // ─── Typing indicators ───────────────────────────────────────
  const handleTextChange = useCallback(
    (val: string) => {
      setText(val);
      if (!convId) return;

      if (!isTypingRef.current) {
        isTypingRef.current = true;
        socketService.startTyping(convId);
      }

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        socketService.stopTyping(convId);
      }, TYPING_DEBOUNCE_MS);
    },
    [convId]
  );

  // ─── Send message ────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !convId || isSending) return;

    // Clear typing
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    isTypingRef.current = false;
    socketService.stopTyping(convId);

    setText('');
    setIsSending(true);
    Keyboard.dismiss();

    try {
      const sent = await chatApi.sendMessage(convId, trimmed);
      // The backend will emit new_message via Socket.IO to all *other* members.
      // For the sender we add it directly to avoid duplication.
      if (!knownIdsRef.current.has(sent._id)) {
        knownIdsRef.current.add(sent._id);
        setMessages((prev) => [sent, ...prev]);
        updateConversationLastMessage(convId, sent);
      }
    } catch (err) {
      console.error('[conversation] sendMessage error:', err);
      setText(trimmed); // restore on failure
    } finally {
      setIsSending(false);
    }
  }, [convId, isSending, text, updateConversationLastMessage]);

  // ─── Render a single message bubble ─────────────────────────
  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const isMe = item.sender?._id === user?._id;
      const prevMsg = messages[index + 1];
      const showAvatar = !isMe && (!prevMsg || prevMsg.sender?._id !== item.sender?._id);

      if (item.isDeleted) {
        return (
          <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
            <Text style={[styles.deletedText, { color: colors.textTertiary }]}>
              Message deleted
            </Text>
          </View>
        );
      }

      const bubbleColor = isMe
        ? Colors.primary
        : isDark
        ? colors.surfaceElevated
        : colors.surface;

      const textColor = isMe ? Colors.white : colors.text;

      return (
        <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
          {!isMe && (
            <View style={styles.avatarSlot}>
              {showAvatar ? (
                <UserAvatar uri={item.sender?.profilePicture} size="sm" />
              ) : (
                <View style={styles.avatarPlaceholder} />
              )}
            </View>
          )}

          <View style={styles.bubbleBody}>
            {!isMe && showAvatar && (
              <Text style={[styles.senderName, { color: colors.textTertiary }]}>
                {item.sender?.username}
              </Text>
            )}
            <View style={[styles.bubble, { backgroundColor: bubbleColor }]}>
              <Text style={[styles.bubbleText, { color: textColor }]}>{item.content.text}</Text>
            </View>
            <Text style={[styles.timestamp, { color: colors.textTertiary }, isMe && styles.timestampMe]}>
              {formatMessageTime(item.createdAt)}
            </Text>
          </View>
        </View>
      );
    },
    [colors, isDark, messages, user?._id]
  );

  const typingLabel = useMemo(() => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0]} is typing…`;
    return 'Several people are typing…';
  }, [typingUsers]);

  const keyboardOffset = useMemo(() => insets.top + 56, [insets.top]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, (event: any) => {
      const windowHeight = Dimensions.get('window').height;
      const eventHeight = event?.endCoordinates?.height ?? 0;
      const screenY = event?.endCoordinates?.screenY ?? windowHeight;
      const derivedHeight = Math.max(0, windowHeight - screenY);
      setKeyboardHeight(Math.max(eventHeight, derivedHeight));
    });

    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? keyboardOffset : 0}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={HitSlop.md}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {title ?? 'Chat'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Message list — inverted so newest is at bottom */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.messageList}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator color={Colors.primary} style={styles.loadingMore} />
            ) : null
          }
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Typing indicator */}
      {typingLabel && (
        <View style={[styles.typingBar, { backgroundColor: colors.background }]}>
          <Text style={[styles.typingText, { color: colors.textTertiary }]}>{typingLabel}</Text>
        </View>
      )}

      {/* Input bar */}
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom + Spacing.xs, keyboardHeight + Spacing.xs),
          },
        ]}
      >
        <View style={[styles.inputWrap, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Message…"
            placeholderTextColor={colors.textTertiary}
            value={text}
            onChangeText={handleTextChange}
            multiline
            maxLength={2000}
            returnKeyType="default"
          />
        </View>
        <Pressable
          style={[
            styles.sendBtn,
            { backgroundColor: text.trim() ? Colors.primary : colors.surfaceElevated },
          ]}
          onPress={handleSend}
          disabled={!text.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Ionicons
              name="send"
              size={18}
              color={text.trim() ? Colors.white : colors.textTertiary}
            />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.size.md,
    fontFamily: Typography.fontFamily.semiBold,
    marginHorizontal: Spacing.sm,
  },
  messageList: { padding: Spacing.sm, gap: 4 },
  loadingMore: { paddingVertical: Spacing.md },

  // Bubbles
  bubbleRow: { flexDirection: 'row', marginVertical: 2, maxWidth: '80%' },
  bubbleRowMe: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  bubbleRowThem: { alignSelf: 'flex-start' },
  avatarSlot: { width: 32, justifyContent: 'flex-end', marginRight: 6 },
  avatarPlaceholder: { width: 32 },
  bubbleBody: { flexShrink: 1 },
  senderName: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
  },
  bubbleText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.fontFamily.regular,
    lineHeight: 20,
  },
  deletedText: {
    fontSize: Typography.size.sm,
    fontStyle: 'italic',
    paddingHorizontal: Spacing.sm,
  },
  timestamp: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.regular,
    marginTop: 2,
    marginLeft: 4,
    alignSelf: 'flex-start',
  },
  timestampMe: { alignSelf: 'flex-end', marginLeft: 0, marginRight: 4 },

  // Typing
  typingBar: { paddingHorizontal: Spacing.md, paddingVertical: 4 },
  typingText: { fontSize: Typography.size.xs, fontStyle: 'italic' },

  // Input
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 0.5,
  },
  inputWrap: {
    flex: 1,
    borderRadius: Radii.xl,
    borderWidth: 0.5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    maxHeight: 120,
  },
  input: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.fontFamily.regular,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 0 : 2,
  },
});
