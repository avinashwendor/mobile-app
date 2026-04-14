import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../src/theme/tokens';
import UserAvatar from '../../src/components/UserAvatar';
import GradientButton from '../../src/components/GradientButton';
import * as userApi from '../../src/api/user.api';
import * as followApi from '../../src/api/follow.api';
import type { UserSearchResult } from '../../src/api/user.api';

type TabType = 'followers' | 'following';

export default function FollowersScreen() {
  const { username, tab } = useLocalSearchParams<{ username: string; tab: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<TabType>((tab as TabType) || 'followers');
  const [followers, setFollowers] = useState<UserSearchResult[]>([]);
  const [following, setFollowing] = useState<UserSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [followerPage, setFollowerPage] = useState(1);
  const [followingPage, setFollowingPage] = useState(1);
  const [followerHasMore, setFollowerHasMore] = useState(true);
  const [followingHasMore, setFollowingHasMore] = useState(true);

  const fetchFollowers = useCallback(async (p: number) => {
    if (!username) return;
    try {
      const result = await userApi.getUserFollowers(username, p);
      if (p === 1) {
        setFollowers(result.followers);
      } else {
        setFollowers((prev) => [...prev, ...result.followers]);
      }
      setFollowerHasMore(result.hasMore);
      setFollowerPage(p);
    } catch (err) {
      console.error('Failed to load followers:', err);
    }
  }, [username]);

  const fetchFollowing = useCallback(async (p: number) => {
    if (!username) return;
    try {
      const result = await userApi.getUserFollowing(username, p);
      if (p === 1) {
        setFollowing(result.following);
      } else {
        setFollowing((prev) => [...prev, ...result.following]);
      }
      setFollowingHasMore(result.hasMore);
      setFollowingPage(p);
    } catch (err) {
      console.error('Failed to load following:', err);
    }
  }, [username]);

  useEffect(() => {
    (async () => {
      await Promise.all([fetchFollowers(1), fetchFollowing(1)]);
      setIsLoading(false);
    })();
  }, [username]);

  const data = activeTab === 'followers' ? followers : following;
  const hasMore = activeTab === 'followers' ? followerHasMore : followingHasMore;
  const currentPage = activeTab === 'followers' ? followerPage : followingPage;

  const renderUser = useCallback(({ item }: { item: UserSearchResult }) => (
    <Pressable
      style={styles.userRow}
      onPress={() => router.push({ pathname: '/(screens)/user/[id]', params: { id: item.username } })}
    >
      <UserAvatar uri={item.profilePicture} size="md" />
      <View style={styles.userInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={[styles.username, { color: colors.text }]}>{item.username}</Text>
          {item.isVerified && <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />}
        </View>
        <Text style={[styles.fullName, { color: colors.textSecondary }]}>{item.fullName}</Text>
      </View>
    </Pressable>
  ), [colors]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={HitSlop.md}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{username}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(['followers', 'following'] as TabType[]).map((t) => (
          <Pressable key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, { color: activeTab === t ? colors.text : colors.textTertiary }]}>
              {t === 'followers' ? `Followers` : `Following`}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={data}
          renderItem={renderUser}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          onEndReached={() => {
            if (hasMore) {
              if (activeTab === 'followers') fetchFollowers(currentPage + 1);
              else fetchFollowing(currentPage + 1);
            }
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={40} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {activeTab === 'followers' ? 'No followers yet' : 'Not following anyone'}
              </Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingBottom: Spacing.md },
  headerTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },
  tabs: { flexDirection: 'row', borderBottomWidth: 0.5 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base },
  list: { paddingVertical: Spacing.sm },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  userInfo: { flex: 1, marginLeft: Spacing.md },
  username: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base },
  fullName: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base },
});
