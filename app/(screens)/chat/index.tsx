import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../../src/theme/tokens';
import UserAvatar from '../../../src/components/UserAvatar';
import { useChatStore } from '../../../src/stores/chatStore';
import { useAuthStore } from '../../../src/stores/authStore';
import { timeAgo } from '../../../src/utils/formatters';
import type { Conversation } from '../../../src/api/chat.api';

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);

  const { conversations, isLoading, fetchConversations } = useChatStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchConversations();
    setIsRefreshing(false);
  }, [fetchConversations]);

  /** Returns the display name / avatar of the *other* participant in a DM */
  const getPeer = useCallback(
    (conv: Conversation) => {
      if (conv.isGroup) {
        return { name: conv.groupName ?? 'Group', avatar: null };
      }
      const peer = conv.participants.find((p) => p._id !== user?._id) ?? conv.participants[0];
      return {
        name: peer?.username ?? 'Unknown',
        avatar: peer?.profilePicture ?? null,
        peerId: peer?._id,
        peerUsername: peer?.username,
      };
    },
    [user?._id]
  );

  const filtered = query.trim()
    ? conversations.filter((c) => {
        const peer = getPeer(c);
        return peer.name.toLowerCase().includes(query.toLowerCase());
      })
    : conversations;

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => {
      const peer = getPeer(item);
      const hasUnread = item.unreadCount > 0;
      const lastText = item.lastMessage?.isDeleted
        ? 'Message deleted'
        : item.lastMessage?.content?.text ?? '';
      const fromMe = item.lastMessage?.sender?._id === user?._id;
      const preview = lastText
        ? `${fromMe ? 'You: ' : ''}${lastText}`
        : 'Tap to start chatting';

      return (
        <Pressable
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: pressed ? colors.surfaceElevated : 'transparent' },
          ]}
          onPress={() =>
            router.push({
              pathname: '/(screens)/chat/[convId]',
              params: { convId: item._id },
            })
          }
        >
          <UserAvatar uri={peer.avatar} size="lg" />

          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <Text
                style={[
                  styles.peerName,
                  { color: colors.text, fontFamily: hasUnread ? Typography.fontFamily.semiBold : Typography.fontFamily.medium },
                ]}
                numberOfLines={1}
              >
                {peer.name}
              </Text>
              <Text style={[styles.time, { color: hasUnread ? Colors.primary : colors.textTertiary }]}>
                {item.lastActivity ? timeAgo(item.lastActivity) : ''}
              </Text>
            </View>

            <View style={styles.rowBottom}>
              <Text
                style={[
                  styles.preview,
                  {
                    color: hasUnread ? colors.textSecondary : colors.textTertiary,
                    fontFamily: hasUnread ? Typography.fontFamily.medium : Typography.fontFamily.regular,
                  },
                ]}
                numberOfLines={1}
              >
                {preview}
              </Text>
              {hasUnread && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      );
    },
    [colors, getPeer, router, user?._id]
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
        <Pressable
          hitSlop={HitSlop.md}
          onPress={() => {
            /* future: new-conversation picker */
          }}
        >
          <Ionicons name="create-outline" size={24} color={colors.text} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search conversations"
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={HitSlop.sm}>
            <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>

      {isLoading && conversations.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={filtered.length === 0 ? styles.center : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {query ? 'No conversations match your search' : 'No messages yet'}
              </Text>
              {!query && (
                <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>
                  Start a conversation from a user&apos;s profile
                </Text>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.fontFamily.bold,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.full,
    borderWidth: 0.5,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.size.sm,
    fontFamily: Typography.fontFamily.regular,
    paddingVertical: 2,
  },
  list: { paddingBottom: Spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xxl },
  emptyText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.fontFamily.medium,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.fontFamily.regular,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  peerName: { fontSize: Typography.size.md, flex: 1, marginRight: Spacing.xs },
  time: { fontSize: Typography.size.xs, fontFamily: Typography.fontFamily.regular },
  preview: { fontSize: Typography.size.sm, flex: 1, marginRight: Spacing.xs },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
  },
});
