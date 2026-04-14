import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, Pressable, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../../src/theme/tokens';
import UserAvatar from '../../../src/components/UserAvatar';
import * as chatApi from '../../../src/api/chat.api';
import { useAuthStore } from '../../../src/stores/authStore';
import { socketService } from '../../../src/services/socketService';
import { formatMessageTime } from '../../../src/utils/formatters';
import type { ChatMessage } from '../../../src/api/chat.api';

export default function ChatThreadScreen() {
  const { convId } = useLocalSearchParams<{ convId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMessages = useCallback(async (p: number, refresh = false) => {
    if (!convId) return;
    try {
      const result = await chatApi.getMessages(convId, p, 50);
      const sorted = result.messages.reverse();
      if (refresh) {
        setMessages(sorted);
      } else {
        setMessages((prev) => [...sorted, ...prev]);
      }
      setHasMore(result.hasMore);
      setPage(p);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, [convId]);

  // Initial load + WebSocket setup
  useEffect(() => {
    if (!convId) return;

    fetchMessages(1, true).then(() => setIsLoading(false));

    // Join the conversation room for real-time updates
    socketService.joinConversation(convId);

    const unsubNewMsg = socketService.on('new_message', (msg: ChatMessage) => {
      if (msg.sender?._id !== user?._id) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    const unsubTyping = socketService.on('user_typing', (data: any) => {
      if (data.conversation_id === convId && data.user_id !== user?._id) {
        setTypingUser(data.username);
      }
    });

    const unsubStopTyping = socketService.on('user_stopped_typing', (data: any) => {
      if (data.conversation_id === convId) {
        setTypingUser(null);
      }
    });

    return () => {
      socketService.leaveConversation(convId);
      unsubNewMsg();
      unsubTyping();
      unsubStopTyping();
    };
  }, [convId]);

  const handleTyping = useCallback((text: string) => {
    setNewMessage(text);
    if (!isTyping && convId) {
      setIsTyping(true);
      socketService.startTyping(convId);
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      setIsTyping(false);
      if (convId) socketService.stopTyping(convId);
    }, 2000);
  }, [isTyping, convId]);

  const handleSend = useCallback(async () => {
    if (!newMessage.trim() || isSending || !convId) return;
    setIsSending(true);

    // Optimistic message
    const tempMsg: ChatMessage = {
      _id: `temp-${Date.now()}`,
      sender: user as any,
      content: { text: newMessage.trim() },
      messageType: 'text',
      createdAt: new Date().toISOString(),
      readBy: [],
      isDeleted: false,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setNewMessage('');

    if (isTyping && convId) {
      socketService.stopTyping(convId);
      setIsTyping(false);
    }

    try {
      const realMsg = await chatApi.sendMessage(convId, newMessage.trim());
      setMessages((prev) =>
        prev.map((m) => (m._id === tempMsg._id ? realMsg : m)),
      );
    } catch (err) {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m._id !== tempMsg._id));
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  }, [newMessage, isSending, convId, user, isTyping]);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isMine = item.sender?._id === user?._id;
    const isTemp = item._id.startsWith('temp-');

    return (
      <View style={[styles.msgContainer, isMine ? styles.msgMine : styles.msgOther]}>
        {!isMine && (
          <Pressable onPress={() => item.sender && router.push({ pathname: '/(screens)/user/[id]', params: { id: item.sender.username || '' } })}>
            <UserAvatar uri={item.sender?.profilePicture} size="xs" />
          </Pressable>
        )}
        <View style={[
          styles.bubble,
          isMine
            ? [styles.bubbleMine, { backgroundColor: Colors.primary }]
            : [styles.bubbleOther, { backgroundColor: colors.surfaceElevated }],
          isTemp && { opacity: 0.6 },
        ]}>
          {item.isDeleted ? (
            <Text style={[styles.deletedText, { color: isMine ? 'rgba(255,255,255,0.6)' : colors.textTertiary }]}>
              <Ionicons name="ban-outline" size={12} /> This message was deleted
            </Text>
          ) : (
            <Text style={[styles.msgText, { color: isMine ? Colors.white : colors.text }]}>
              {item.content?.text || ''}
            </Text>
          )}
        </View>
        <View style={[styles.msgMeta, isMine ? styles.metaMine : styles.metaOther]}>
          <Text style={[styles.msgTime, { color: colors.textTertiary }]}>
            {formatMessageTime(item.createdAt)}
          </Text>
          {isMine && !isTemp && (
            <Text style={[styles.readReceipt, { color: (item.readBy?.length ?? 0) > 1 ? Colors.accent : colors.textTertiary }]}>
              {(item.readBy?.length ?? 0) > 1 ? '✓✓' : '✓'}
            </Text>
          )}
        </View>
      </View>
    );
  }, [user, colors]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={HitSlop.md}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Chat</Text>
          {typingUser && (
            <Text style={[styles.typingText, { color: Colors.primary }]}>
              {typingUser} is typing...
            </Text>
          )}
        </View>
        <Pressable><Ionicons name="call-outline" size={22} color={colors.text} /></Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubble-ellipses-outline" size={40} color={Colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Say hello! 👋</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Start the conversation with a message
              </Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + Spacing.sm }]}>
          <Pressable style={styles.attachBtn}>
            <Ionicons name="image-outline" size={22} color={colors.textSecondary} />
          </Pressable>
          <TextInput
            value={newMessage}
            onChangeText={handleTyping}
            placeholder="Message..."
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            multiline
            maxLength={2000}
          />
          {newMessage.trim() ? (
            <Pressable onPress={handleSend} disabled={isSending} style={[styles.sendBtn, { backgroundColor: Colors.primary }]}>
              <Ionicons name="send" size={18} color={Colors.white} />
            </Pressable>
          ) : (
            <Pressable style={styles.micBtn}>
              <Ionicons name="mic-outline" size={22} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, borderBottomWidth: 0.5 },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },
  typingText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, marginTop: 1 },
  messageList: { padding: Spacing.base, paddingBottom: Spacing.lg },
  msgContainer: { marginVertical: Spacing.xxs, maxWidth: '80%', flexDirection: 'row', gap: Spacing.xs, alignItems: 'flex-end' },
  msgMine: { alignSelf: 'flex-end' },
  msgOther: { alignSelf: 'flex-start' },
  bubble: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  bubbleMine: { borderRadius: 18, borderBottomRightRadius: 4 },
  bubbleOther: { borderRadius: 18, borderBottomLeftRadius: 4 },
  msgText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base, lineHeight: 22 },
  deletedText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, fontStyle: 'italic' },
  msgMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 },
  metaMine: { justifyContent: 'flex-end' },
  metaOther: { justifyContent: 'flex-start' },
  msgTime: { fontFamily: Typography.fontFamily.regular, fontSize: 10 },
  readReceipt: { fontFamily: Typography.fontFamily.medium, fontSize: 10 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 0.5, gap: Spacing.xs },
  attachBtn: { padding: Spacing.sm },
  input: { flex: 1, fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base, borderRadius: 22, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, maxHeight: 100, borderWidth: 1 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  micBtn: { padding: Spacing.sm },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(108,92,231,0.12)', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm },
});
