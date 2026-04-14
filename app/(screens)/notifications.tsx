import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../src/theme/tokens';
import UserAvatar from '../../src/components/UserAvatar';
import GradientButton from '../../src/components/GradientButton';
import * as notificationApi from '../../src/api/notification.api';
import { timeAgo } from '../../src/utils/formatters';
import type { Notification } from '../../src/api/notification.api';

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchNotifications = useCallback(async (p: number, refresh = false) => {
    try {
      const result = await notificationApi.getNotifications(p, 20);
      if (refresh) {
        setNotifications(result.notifications);
      } else {
        setNotifications((prev) => [...prev, ...result.notifications]);
      }
      setUnreadCount(result.unreadCount);
      setHasMore(result.hasMore);
      setPage(p);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(1, true).then(() => setIsLoading(false));
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchNotifications(1, true);
    setIsRefreshing(false);
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  }, []);

  const handlePress = useCallback((n: Notification) => {
    if (!n.isRead) {
      notificationApi.markRead(n._id).catch(() => {});
      setNotifications((prev) => prev.map((item) => item._id === n._id ? { ...item, isRead: true } : item));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    // Navigate based on type
    if (n.contentType === 'post') {
      router.push({ pathname: '/(screens)/post/[id]', params: { id: n.contentId! } });
    } else if (n.contentType === 'reel') {
      // Navigate to reels tab
    } else if (n.type === 'follow' || n.type === 'follow_request' || n.type === 'follow_accept') {
      if (n.sender) router.push({ pathname: '/(screens)/user/[id]', params: { id: n.sender.username } });
    }
  }, []);

  function notifIcon(type: string) {
    switch (type) {
      case 'like': return { name: 'heart' as const, color: Colors.likeFilled };
      case 'comment': case 'comment_reply': return { name: 'chatbubble' as const, color: Colors.accent };
      case 'follow': case 'follow_accept': return { name: 'person-add' as const, color: Colors.primary };
      case 'follow_request': return { name: 'person-add-outline' as const, color: Colors.coral };
      case 'mention': return { name: 'at' as const, color: Colors.coral };
      default: return { name: 'notifications' as const, color: Colors.primary };
    }
  }

  const renderNotification = useCallback(({ item }: { item: Notification }) => {
    const icon = notifIcon(item.type);
    return (
      <Pressable
        style={[styles.notifRow, { backgroundColor: item.isRead ? 'transparent' : colors.surfaceElevated }]}
        onPress={() => handlePress(item)}
      >
        {item.sender ? (
          <UserAvatar uri={item.sender.profilePicture} size="md" />
        ) : (
          <View style={[styles.iconCircle, { backgroundColor: icon.color + '20' }]}>
            <Ionicons name={icon.name} size={20} color={icon.color} />
          </View>
        )}
        <View style={styles.notifContent}>
          <Text style={[styles.notifText, { color: colors.text }]} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={[styles.notifTime, { color: colors.textTertiary }]}>{timeAgo(item.createdAt)}</Text>
        </View>
        <View style={styles.notifIconBadge}>
          <Ionicons name={icon.name} size={14} color={icon.color} />
        </View>
      </Pressable>
    );
  }, [colors]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={HitSlop.md}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Notifications {unreadCount > 0 ? `(${unreadCount})` : ''}
        </Text>
        {unreadCount > 0 ? (
          <Pressable onPress={handleMarkAllRead}>
            <Text style={[styles.markAll, { color: Colors.primary }]}>Read all</Text>
          </Pressable>
        ) : <View style={{ width: 50 }} />}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
          onEndReached={() => hasMore && fetchNotifications(page + 1)}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No notifications yet</Text>
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
  headerTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },
  markAll: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm },
  notifRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, borderRadius: Radii.sm },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  notifContent: { flex: 1, marginLeft: Spacing.md },
  notifText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, lineHeight: 20 },
  notifTime: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, marginTop: 2 },
  notifIconBadge: { marginLeft: Spacing.sm },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base },
});
