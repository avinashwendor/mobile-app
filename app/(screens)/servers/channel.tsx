import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
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
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../../src/theme/tokens';
import { useAuthStore } from '../../../src/stores/authStore';
import { socketService } from '../../../src/services/socketService';
import * as serverApi from '../../../src/api/server.api';
import type { ServerMessage } from '../../../src/api/server.api';
import { formatMessageTime } from '../../../src/utils/formatters';

const CHANNEL_TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  text: 'chatbubbles',
  announcement: 'megaphone',
  voice: 'mic',
};

function MessageBubble({
  message,
  isMine,
  showAvatar,
  colors,
}: {
  message: ServerMessage;
  isMine: boolean;
  showAvatar: boolean;
  colors: any;
}) {
  return (
    <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
      {/* Avatar placeholder — keeps spacing consistent */}
      <View style={styles.avatarSlot}>
        {!isMine && showAvatar && (
          message.authorAvatar ? (
            <Image source={{ uri: message.authorAvatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, { backgroundColor: Colors.primary + '33', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 13 }}>
                {(message.authorUsername[0] ?? '?').toUpperCase()}
              </Text>
            </View>
          )
        )}
      </View>

      <View style={[styles.bubbleCol, isMine && styles.bubbleColMine]}>
        {!isMine && showAvatar && (
          <Text style={[styles.bubbleAuthor, { color: Colors.primary }]}>{message.authorUsername}</Text>
        )}
        <View style={[
          styles.bubble,
          isMine
            ? { backgroundColor: Colors.primary }
            : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
        ]}>
          <Text style={[styles.bubbleText, { color: isMine ? Colors.white : colors.text }]}>
            {message.text}
          </Text>
        </View>
        <Text style={[styles.bubbleTime, { color: colors.textTertiary }]}>
          {formatMessageTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

export default function ChannelScreen() {
  const { serverId, channelId, channelName, channelType } = useLocalSearchParams<{
    serverId: string;
    channelId: string;
    channelName: string;
    channelType: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const authUser = useAuthStore((s) => s.user);

  const [messages, setMessages] = useState<ServerMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const listRef = useRef<FlatList<ServerMessage>>(null);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);
  const isVoice = channelType === 'voice';
  const keyboardOffset = insets.top + 56;

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

  // ── Load initial messages ──────────────────────────────────
  const loadMessages = useCallback(async (reset = false) => {
    if (!serverId || !channelId) return;
    try {
      const result = await serverApi.getChannelMessages(
        serverId,
        channelId,
        reset ? null : cursorRef.current,
      );
      cursorRef.current = result.cursor;
      hasMoreRef.current = result.hasMore;
      setHasMore(result.hasMore);
      if (reset) {
        setMessages(result.messages);
      } else {
        setMessages((prev) => [...prev, ...result.messages]);
      }
    } catch (err) {
      console.error('[ChannelScreen] loadMessages error:', err);
    }
  }, [serverId, channelId]);

  useEffect(() => {
    (async () => {
      await loadMessages(true);
      setIsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Socket: join/leave channel ─────────────────────────────
  useEffect(() => {
    if (!channelId) return;
    socketService.joinChannel(channelId);

    const unsubMessage = socketService.on('channel_message', (payload: any) => {
      if (payload?.channel_id !== channelId) return;
      const msg: ServerMessage = {
        _id: String(payload._id ?? payload.id ?? Date.now()),
        channelId,
        authorId: String(payload.author_id ?? payload.authorId ?? ''),
        authorUsername: payload.author_username ?? payload.authorUsername ?? '',
        authorAvatar: payload.author_avatar ?? payload.authorAvatar ?? null,
        text: payload.text ?? (typeof payload.content === 'object' && payload.content !== null ? payload.content.text : payload.content) ?? '',
        createdAt: payload.created_at ?? payload.createdAt ?? new Date().toISOString(),
      };
      setMessages((prev) => {
        // Deduplicate by _id
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [msg, ...prev];
      });
      // Auto-scroll to bottom for new incoming messages
      setTimeout(() => {
        try { listRef.current?.scrollToOffset({ offset: 0, animated: true }); } catch {}
      }, 60);
    });

    const unsubOnline = socketService.on('channel_online_count', (payload: any) => {
      if (payload?.channel_id === channelId) setOnlineCount(Number(payload.count ?? 0));
    });

    return () => {
      socketService.leaveChannel(channelId);
      unsubMessage();
      unsubOnline();
    };
  }, [channelId]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !serverId || !channelId || isSending) return;
    Keyboard.dismiss();
    setIsSending(true);
    setText('');
    try {
      const msg = await serverApi.sendChannelMessage(serverId, channelId, trimmed);
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [msg, ...prev];
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => {
        try { listRef.current?.scrollToOffset({ offset: 0, animated: true }); } catch {}
      }, 60);
    } catch (err: any) {
      setText(trimmed); // restore on failure
      console.error('[ChannelScreen] sendMessage error:', err);
    } finally {
      setIsSending(false);
    }
  }, [text, serverId, channelId, isSending]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMoreRef.current || isLoadingMore) return;
    setIsLoadingMore(true);
    await loadMessages(false);
    setIsLoadingMore(false);
  }, [isLoadingMore, loadMessages]);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? keyboardOffset : 0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.xs, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={HitSlop.md}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Ionicons
            name={CHANNEL_TYPE_ICON[channelType ?? 'text'] as any}
            size={18}
            color={Colors.primary}
          />
          <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
            {channelName}
          </Text>
        </View>
        {onlineCount !== null && (
          <View style={styles.onlinePill}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>{onlineCount}</Text>
          </View>
        )}
      </View>

      {isVoice ? (
        // Voice channels — not interactive text chat
        <View style={styles.voicePlaceholder}>
          <Ionicons name="mic-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.voiceTitle, { color: colors.text }]}>Voice Channel</Text>
          <Text style={[styles.voiceSubtitle, { color: colors.textSecondary }]}>
            Voice functionality coming soon.
          </Text>
        </View>
      ) : isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item._id}
            inverted
            keyboardShouldPersistTaps="handled"
            renderItem={({ item, index }) => {
              const nextMsg = messages[index + 1];
              const showAvatar = !nextMsg || nextMsg.authorId !== item.authorId;
              const isMine = item.authorId === authUser?._id;
              return (
                <Animated.View entering={FadeInDown.duration(200)}>
                  <MessageBubble
                    message={item}
                    isMine={isMine}
                    showAvatar={showAvatar}
                    colors={colors}
                  />
                </Animated.View>
              );
            }}
            contentContainerStyle={styles.messageList}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={isLoadingMore ? <ActivityIndicator color={Colors.primary} style={styles.loadMoreIndicator} /> : null}
            ListEmptyComponent={
              <View style={styles.emptyChannel}>
                <Ionicons name="chatbubbles-outline" size={40} color={colors.textTertiary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No messages yet</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Be the first to say something!
                </Text>
              </View>
            }
          />

          {/* Input */}
          <View style={[
            styles.inputBar,
            { paddingBottom: Math.max(insets.bottom + Spacing.sm, keyboardHeight + Spacing.xs), borderTopColor: colors.border, backgroundColor: colors.background },
          ]}>
            <TextInput
              style={[
                styles.input,
                { color: colors.text, backgroundColor: isDark ? colors.surfaceElevated : colors.surface, borderColor: colors.border },
              ]}
              placeholder={`Message #${channelName ?? 'channel'}`}
              placeholderTextColor={colors.textTertiary}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={2000}
              returnKeyType="default"
            />
            <Pressable
              onPress={handleSend}
              disabled={!text.trim() || isSending}
              style={[styles.sendBtn, { opacity: text.trim() ? 1 : 0.4 }]}
              hitSlop={HitSlop.sm}
            >
              {isSending
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Ionicons name="send" size={18} color={Colors.white} />}
            </Pressable>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.base,
    flex: 1,
  },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.success },
  onlineText: { color: Colors.success, fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.xs },
  messageList: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, flexGrow: 1, justifyContent: 'flex-end' },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
    alignItems: 'flex-end',
  },
  bubbleRowMine: { flexDirection: 'row-reverse' },
  avatarSlot: { width: 32, marginRight: Spacing.sm },
  avatar: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden' },
  bubbleCol: { maxWidth: '72%' },
  bubbleColMine: { alignItems: 'flex-end' },
  bubbleAuthor: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.xs,
    marginBottom: 2,
    marginLeft: Spacing.xs,
  },
  bubble: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.lg,
    maxWidth: '100%',
  },
  bubbleText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.base,
    lineHeight: 20,
  },
  bubbleTime: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 10,
    marginTop: 3,
    marginHorizontal: Spacing.xs,
  },
  loadMoreIndicator: { paddingVertical: Spacing.base },
  emptyChannel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: Spacing.sm,
  },
  emptyTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },
  emptySubtitle: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base, textAlign: 'center' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.base,
    maxHeight: 120,
    lineHeight: 20,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  voiceTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.lg },
  voiceSubtitle: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base, textAlign: 'center' },
});
