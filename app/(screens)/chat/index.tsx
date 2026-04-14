import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../../src/theme/tokens';
import UserAvatar from '../../../src/components/UserAvatar';
import * as chatApi from '../../../src/api/chat.api';
import { useAuthStore } from '../../../src/stores/authStore';
import { timeAgo, truncate } from '../../../src/utils/formatters';
import type { Conversation } from '../../../src/api/chat.api';

export default function ChatListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const result = await chatApi.getConversations(1, 30);
      setConversations(result.conversations);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, []);

  useEffect(() => {
    fetchConversations().then(() => setIsLoading(false));
  }, []);

  const renderConversation = useCallback(({ item }: { item: Conversation }) => {
    const otherUser = item.participants.find((p) => p._id !== user?._id);
    const displayName = item.isGroup ? (item.groupName || 'Group Chat') : (otherUser?.fullName || 'Unknown');
    const avatar = item.isGroup ? undefined : otherUser?.profilePicture;
    const lastMsg = item.lastMessage;

    return (
      <Pressable
        style={[styles.convRow, { backgroundColor: item.unreadCount > 0 ? colors.surfaceElevated : 'transparent' }]}
        onPress={() => router.push({ pathname: '/(screens)/chat/[convId]', params: { convId: item._id } })}
      >
        <UserAvatar uri={avatar} size="lg" />
        <View style={styles.convContent}>
          <Text style={[styles.convName, { color: colors.text, fontFamily: item.unreadCount > 0 ? Typography.fontFamily.bold : Typography.fontFamily.medium }]} numberOfLines={1}>
            {displayName}
          </Text>
          {lastMsg && (
            <Text style={[styles.convLastMsg, { color: item.unreadCount > 0 ? colors.text : colors.textTertiary }]} numberOfLines={1}>
              {lastMsg.content?.text || (lastMsg.messageType === 'media' ? '📷 Media' : '')}
            </Text>
          )}
        </View>
        <View style={styles.convMeta}>
          {item.lastActivity && (
            <Text style={[styles.convTime, { color: colors.textTertiary }]}>{timeAgo(item.lastActivity)}</Text>
          )}
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  }, [user, colors]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={HitSlop.md}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
        <Pressable><Ionicons name="create-outline" size={24} color={colors.text} /></Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No conversations yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, borderBottomWidth: 0.5 },
  headerTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.lg },
  list: { paddingTop: Spacing.sm },
  convRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  convContent: { flex: 1, marginLeft: Spacing.md },
  convName: { fontSize: Typography.size.base, marginBottom: 2 },
  convLastMsg: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm },
  convMeta: { alignItems: 'flex-end', gap: Spacing.xs },
  convTime: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },
  unreadBadge: { backgroundColor: Colors.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { fontFamily: Typography.fontFamily.bold, fontSize: 11, color: Colors.white },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base },
});
