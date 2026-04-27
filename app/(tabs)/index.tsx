import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../../src/theme/tokens';
import { PostCard } from '../../src/components/PostCard';
import UserAvatar from '../../src/components/UserAvatar';
import { useAuthStore } from '../../src/stores/authStore';
import { useNotificationStore } from '../../src/stores/notificationStore';
import { useChatStore } from '../../src/stores/chatStore';
import * as followApi from '../../src/api/follow.api';
import * as postApi from '../../src/api/post.api';
import * as storyApi from '../../src/api/story.api';
import * as userApi from '../../src/api/user.api';
import { compactNumber } from '../../src/utils/formatters';
import type { Post } from '../../src/api/post.api';
import type { StoryGroup } from '../../src/api/story.api';
import type { UserSearchResult } from '../../src/api/user.api';
import ShareSheet from '../../src/components/ShareSheet';

export default function HomeFeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const unreadNotifications = useNotificationStore((state) => state.unreadCount);
  const unreadDms = useChatStore((s) => s.unreadDmCount);

  const [posts, setPosts] = useState<Post[]>([]);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [myStoryGroup, setMyStoryGroup] = useState<StoryGroup | null>(null);
  const [recommendedUsers, setRecommendedUsers] = useState<UserSearchResult[]>([]);
  const [pendingRecommendationIds, setPendingRecommendationIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sharePostId, setSharePostId] = useState<string | null>(null);

  const fetchFeed = useCallback(async (pageNum: number, refresh = false) => {
    try {
      const result = await postApi.getFeed(pageNum, 10);
      if (refresh) {
        setPosts(result.posts);
      } else {
        setPosts((prev) => [...prev, ...result.posts]);
      }
      setHasMore(result.hasMore);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to load feed:', err);
    }
  }, []);

  const fetchStories = useCallback(async () => {
    try {
      const groups = await storyApi.getStoryFeed();
      const uid = user?._id;
      const ownGroup = uid ? (groups.find((g) => g.author._id === uid) ?? null) : null;
      const othersGroups = uid ? groups.filter((g) => g.author._id !== uid) : groups;
      setMyStoryGroup(ownGroup);
      setStoryGroups(othersGroups);
    } catch (err) {
      console.error('Failed to load stories:', err);
    }
  }, [user?._id]);

  const fetchRecommendations = useCallback(async () => {
    try {
      const users = await userApi.getSuggestions(8);
      setRecommendedUsers(users);
    } catch (err) {
      console.error('Failed to load suggestions:', err);
      setRecommendedUsers([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await fetchFeed(1, true);
      setIsLoading(false);
    })();
  }, [fetchFeed]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  useFocusEffect(
    useCallback(() => {
      fetchStories();
    }, [fetchStories]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchFeed(1, true);
    await fetchStories();
    await fetchRecommendations();
    setIsRefreshing(false);
  }, [fetchFeed, fetchRecommendations, fetchStories]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    await fetchFeed(page + 1);
    setIsLoadingMore(false);
  }, [fetchFeed, hasMore, isLoadingMore, page]);

  const renderStoryRow = () => (
    <View style={styles.storySection}>
      <FlatList
        data={storyGroups}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storyList}
        keyExtractor={(item) => item.author._id}
        ListHeaderComponent={
          <Pressable
            style={styles.storyItem}
            onPress={() => {
              if (myStoryGroup && user?._id) {
                router.push({ pathname: '/(screens)/story-viewer', params: { userId: user._id } });
              } else {
                router.push('/(screens)/create-story');
              }
            }}
          >
            <LinearGradient
              colors={myStoryGroup ? ([...Colors.gradientStory] as any) : [colors.border, colors.border]}
              style={styles.storyRing}
            >
              <View style={[styles.storyRingInner, { backgroundColor: colors.background }]}>
                <UserAvatar uri={user?.profilePicture} size="lg" priority="high" />
              </View>
            </LinearGradient>
            {!myStoryGroup && (
              <View style={[styles.addStoryBadge, { position: 'absolute', bottom: 20, right: 0 }]}>
                <LinearGradient colors={[...Colors.gradientPrimary]} style={styles.addIcon}>
                  <Ionicons name="add" size={14} color={Colors.white} />
                </LinearGradient>
              </View>
            )}
            <Text style={[styles.storyUsername, { color: colors.textSecondary }]} numberOfLines={1}>
              Your story
            </Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.storyItem}
            onPress={() => router.push({ pathname: '/(screens)/story-viewer', params: { userId: item.author._id } })}
          >
            <LinearGradient
              colors={item.hasViewed ? [colors.border, colors.border] : ([...Colors.gradientStory])}
              style={styles.storyRing}
            >
              <View style={[styles.storyRingInner, { backgroundColor: colors.background }]}>
                <UserAvatar uri={item.author.profilePicture} size="lg" priority="high" />
              </View>
            </LinearGradient>
            <Text style={[styles.storyUsername, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.author.username}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );

  const renderPost = useCallback(({ item }: { item: Post }) => (
    <PostCard
      post={item}
      initialIsLiked={item.isLiked}
      initialIsSaved={item.isSaved}
      onComment={(id) => router.push({ pathname: '/(screens)/post/[id]', params: { id, openComments: '1' } })}
      onShare={(id) => setSharePostId(id)}
      onUserPress={(username) => router.push({ pathname: '/(screens)/user/[id]', params: { id: username } })}
      onPostPress={(id) => router.push({ pathname: '/(screens)/post/[id]', params: { id } })}
    />
  ), [router]);

  const handleFollowRecommendation = useCallback(async (targetUserId: string) => {
    if (pendingRecommendationIds.includes(targetUserId)) {
      return;
    }

    setPendingRecommendationIds((prev) => [...prev, targetUserId]);

    try {
      await followApi.followUser(targetUserId);
      setRecommendedUsers((prev) => prev.filter((candidate) => candidate._id !== targetUserId));
    } catch (err) {
      console.error('Failed to follow suggestion:', err);
    } finally {
      setPendingRecommendationIds((prev) => prev.filter((id) => id !== targetUserId));
    }
  }, [pendingRecommendationIds]);

  const renderRecommendations = () => {
    if (recommendedUsers.length === 0) {
      return null;
    }

    return (
      <View style={styles.recommendationsSection}>
        <View style={styles.recommendationsHeader}>
          <Text style={[styles.recommendationsTitle, { color: colors.text }]}>Recommended for you</Text>
          <Text style={[styles.recommendationsHint, { color: colors.textTertiary }]}>Mutual connections first</Text>
        </View>

        <FlatList
          data={recommendedUsers}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recommendationsList}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => {
            const mutualLabel = item.mutualFollowersCount && item.mutualFollowersCount > 0
              ? item.mutualFollowers && item.mutualFollowers.length > 0
                ? `Followed by ${item.mutualFollowers.join(', ')}${item.mutualFollowersCount > item.mutualFollowers.length ? ` +${item.mutualFollowersCount - item.mutualFollowers.length}` : ''}`
                : `${item.mutualFollowersCount} mutual connection${item.mutualFollowersCount > 1 ? 's' : ''}`
              : `${compactNumber(item.followersCount)} followers`;
            const isPending = pendingRecommendationIds.includes(item._id);

            return (
              <Pressable
                style={[styles.recommendationCard, { borderColor: colors.border }]}
                onPress={() => router.push({ pathname: '/(screens)/user/[id]', params: { id: item.username } })}
              >
                <LinearGradient colors={[...Colors.gradientDark]} style={styles.recommendationGlow}>
                  <View style={[styles.recommendationCardInner, { backgroundColor: colors.surfaceElevated }]}> 
                    <UserAvatar uri={item.profilePicture} size="lg" priority="high" />
                    <Text style={[styles.recommendationUsername, { color: colors.text }]} numberOfLines={1}>
                      {item.username}
                    </Text>
                    <Text style={[styles.recommendationName, { color: colors.textSecondary }]} numberOfLines={1}>
                      {item.fullName}
                    </Text>
                    <Text style={[styles.recommendationMeta, { color: colors.textTertiary }]} numberOfLines={2}>
                      {mutualLabel}
                    </Text>
                    <Pressable
                      style={styles.recommendationFollowButton}
                      onPress={() => handleFollowRecommendation(item._id)}
                      disabled={isPending}
                    >
                      <LinearGradient
                        colors={isPending ? ['#3A3A4A', '#3A3A4A'] : [...Colors.gradientPrimary]}
                        style={styles.recommendationFollowGradient}
                      >
                        <Text style={styles.recommendationFollowText}>{isPending ? '...' : 'Follow'}</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                </LinearGradient>
              </Pressable>
            );
          }}
        />
      </View>
    );
  };

  const renderHeader = () => (
    <View>
      {/* App bar */}
      <View style={[styles.appBar, { paddingTop: insets.top + Spacing.sm }]}>
        <Text style={[styles.logo, { color: colors.text }]}>INSTAYT</Text>
        <View style={styles.appBarActions}>
          <Pressable onPress={() => router.push('/(screens)/notifications')} style={styles.appBarBtn}>
            <Ionicons name="heart-outline" size={26} color={colors.text} />
            {unreadNotifications > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => router.push('/(screens)/chat')} style={styles.appBarBtn}>
            <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
            {unreadDms > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadDms > 9 ? '9+' : unreadDms}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Story row */}
      {renderStoryRow()}
      {renderRecommendations()}
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No posts yet. Follow people to see their content!
            </Text>
          </View>
        }
        ListFooterComponent={isLoadingMore ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />
      <ShareSheet
        visible={!!sharePostId}
        onClose={() => setSharePostId(null)}
        contentType="post"
        contentId={sharePostId || ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  appBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  logo: { fontFamily: Typography.fontFamily.extraBold, fontSize: Typography.size.xl, letterSpacing: 2 },
  appBarActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  appBarBtn: { padding: Spacing.xs },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.likeFilled,
    paddingHorizontal: 4,
  },
  notifBadgeText: { fontFamily: Typography.fontFamily.bold, fontSize: 10, color: Colors.white },
  storySection: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)', paddingBottom: Spacing.md },
  storyList: { paddingHorizontal: Spacing.md, gap: Spacing.md },
  storyItem: { alignItems: 'center', width: 72 },
  storyRing: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', padding: 2.5 },
  storyRingInner: { width: '100%', height: '100%', borderRadius: 30, alignItems: 'center', justifyContent: 'center', padding: 2 },
  addStoryRing: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed' },
  addStoryBadge: { position: 'absolute', bottom: 0, right: 0 },
  addIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0A0A0F' },
  storyUsername: { fontFamily: Typography.fontFamily.regular, fontSize: 10, marginTop: 4, textAlign: 'center' },
  recommendationsSection: { paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  recommendationsHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: Spacing.base, marginBottom: Spacing.md },
  recommendationsTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.md },
  recommendationsHint: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },
  recommendationsList: { paddingHorizontal: Spacing.base, gap: Spacing.md },
  recommendationCard: { width: 196, borderRadius: Radii.lg, borderWidth: 1, overflow: 'hidden' },
  recommendationGlow: { padding: 1 },
  recommendationCardInner: { minHeight: 224, borderRadius: Radii.lg, alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.lg },
  recommendationUsername: { marginTop: Spacing.md, fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.base },
  recommendationName: { marginTop: Spacing.xs, fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm },
  recommendationMeta: { marginTop: Spacing.sm, minHeight: 36, fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, textAlign: 'center', lineHeight: 16 },
  recommendationFollowButton: { marginTop: 'auto', width: '100%' },
  recommendationFollowGradient: { borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.sm },
  recommendationFollowText: { color: Colors.white, fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.massive, gap: Spacing.md },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base, textAlign: 'center', maxWidth: 250 },
  footerLoader: { paddingVertical: Spacing.xl },
});
