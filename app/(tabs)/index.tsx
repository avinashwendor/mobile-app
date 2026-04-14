import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, RefreshControl,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeInRight } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, Shadows, AvatarSizes } from '../../src/theme/tokens';
import { PostCard } from '../../src/components/PostCard';
import UserAvatar from '../../src/components/UserAvatar';
import { useAuthStore } from '../../src/stores/authStore';
import * as postApi from '../../src/api/post.api';
import * as storyApi from '../../src/api/story.api';
import { timeAgo } from '../../src/utils/formatters';
import type { Post } from '../../src/api/post.api';
import type { StoryGroup } from '../../src/api/story.api';
import ShareSheet from '../../src/components/ShareSheet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeFeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const user = useAuthStore((s) => s.user);

  const [posts, setPosts] = useState<Post[]>([]);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
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
      setStoryGroups(groups);
    } catch (err) {
      console.error('Failed to load stories:', err);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await Promise.all([fetchFeed(1, true), fetchStories()]);
      setIsLoading(false);
    })();
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchFeed(1, true), fetchStories()]);
    setIsRefreshing(false);
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    await fetchFeed(page + 1);
    setIsLoadingMore(false);
  }, [hasMore, isLoadingMore, page]);

  const renderStoryRow = () => (
    <View style={styles.storySection}>
      <FlatList
        data={storyGroups}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storyList}
        keyExtractor={(item) => item.author._id}
        ListHeaderComponent={
          <Pressable style={styles.storyItem} onPress={() => router.push('/(tabs)/create')}>
            <View style={[styles.addStoryRing, { borderColor: colors.border }]}>
              <UserAvatar uri={user?.profilePicture} size="lg" />
              <View style={styles.addStoryBadge}>
                <LinearGradient colors={[...Colors.gradientPrimary]} style={styles.addIcon}>
                  <Ionicons name="add" size={14} color={Colors.white} />
                </LinearGradient>
              </View>
            </View>
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
                <UserAvatar uri={item.author.profilePicture} size="lg" />
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
      onComment={(id) => router.push({ pathname: '/(screens)/comments', params: { contentType: 'post', contentId: id } })}
      onShare={(id) => setSharePostId(id)}
      onUserPress={(username) => router.push({ pathname: '/(screens)/user/[id]', params: { id: username } })}
      onPostPress={(id) => router.push({ pathname: '/(screens)/post/[id]', params: { id } })}
    />
  ), []);

  const renderHeader = () => (
    <View>
      {/* App bar */}
      <View style={[styles.appBar, { paddingTop: insets.top + Spacing.sm }]}>
        <Text style={[styles.logo, { color: colors.text }]}>INSTAYT</Text>
        <View style={styles.appBarActions}>
          <Pressable onPress={() => router.push('/(screens)/notifications')} style={styles.appBarBtn}>
            <Ionicons name="heart-outline" size={26} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => router.push('/(screens)/chat')} style={styles.appBarBtn}>
            <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Story row */}
      {renderStoryRow()}
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
  storySection: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)', paddingBottom: Spacing.md },
  storyList: { paddingHorizontal: Spacing.md, gap: Spacing.md },
  storyItem: { alignItems: 'center', width: 72 },
  storyRing: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', padding: 2.5 },
  storyRingInner: { width: '100%', height: '100%', borderRadius: 30, alignItems: 'center', justifyContent: 'center', padding: 2 },
  addStoryRing: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed' },
  addStoryBadge: { position: 'absolute', bottom: 0, right: 0 },
  addIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0A0A0F' },
  storyUsername: { fontFamily: Typography.fontFamily.regular, fontSize: 10, marginTop: 4, textAlign: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.massive, gap: Spacing.md },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base, textAlign: 'center', maxWidth: 250 },
  footerLoader: { paddingVertical: Spacing.xl },
});
