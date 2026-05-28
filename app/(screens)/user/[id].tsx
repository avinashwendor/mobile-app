import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  Dimensions, Alert, Share, FlatList, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../../src/theme/tokens';
import UserAvatar from '../../../src/components/UserAvatar';
import GradientButton from '../../../src/components/GradientButton';
import { useAuthStore } from '../../../src/stores/authStore';
import * as userApi from '../../../src/api/user.api';
import * as followApi from '../../../src/api/follow.api';
import * as storyApi from '../../../src/api/story.api';
import { compactNumber } from '../../../src/utils/formatters';
import type { UserProfile } from '../../../src/api/user.api';
import type { MobilePost } from '../../../src/api/adapters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 1.5;
const GRID_COL = 3;
const TILE_SIZE = Math.floor((SCREEN_WIDTH - GRID_GAP * (GRID_COL - 1)) / GRID_COL);

export default function UserProfileScreen() {
  const { id: username } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const authUser = useAuthStore((s) => s.user);

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [hasStories, setHasStories] = useState(false);
  const [allStoriesViewed, setAllStoriesViewed] = useState(false);

  // Posts state
  const [posts, setPosts] = useState<MobilePost[]>([]);
  const [postsPage, setPostsPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canViewPosts, setCanViewPosts] = useState(false);

  const isOwnProfile = authUser?.username === username;

  /** Load the user's profile metadata */
  const fetchProfile = useCallback(async () => {
    if (!username) return;
    try {
      const p = await userApi.getUserProfile(username);
      setProfile(p);
      setIsFollowing(Boolean(p.isFollowing));

      const canView = !p.isPrivate || Boolean(p.isFollowing) || isOwnProfile;
      setCanViewPosts(canView);

      // Fetch stories for gradient ring
      if (canView && p._id) {
        try {
          const stories = await storyApi.getUserStories(p._id);
          setHasStories(stories.length > 0);
          setAllStoriesViewed(stories.length > 0 && stories.every((s) => s.hasViewed));
        } catch {
          // silently ignore — ring just won't show
        }
      }

      return { profile: p, canView };
    } catch (err) {
      console.error('Failed to load user profile:', err);
      return null;
    }
  }, [isOwnProfile, username]);

  /** Load posts for this user (page 1 or refresh) */
  const fetchPosts = useCallback(async (
    targetUsername: string,
    page: number,
    refresh = false,
  ) => {
    if (postsLoading && !refresh) return;
    setPostsLoading(true);
    try {
      const result = await userApi.getUserPosts(targetUsername, page, 18);
      if (refresh || page === 1) {
        setPosts(result.posts);
      } else {
        setPosts((prev) => [...prev, ...result.posts]);
      }
      setHasMorePosts(result.hasMore);
      setPostsPage(page);
    } catch (err) {
      console.error('Failed to load user posts:', err);
    } finally {
      setPostsLoading(false);
    }
  }, [postsLoading]);

  // Initial load
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const result = await fetchProfile();
      if (result?.canView && username) {
        await fetchPosts(username, 1, true);
      }
      setIsLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  /** Pull-to-refresh */
  const handleRefresh = useCallback(async () => {
    if (!username) return;
    setIsRefreshing(true);
    const result = await fetchProfile();
    if (result?.canView) {
      await fetchPosts(username, 1, true);
    }
    setIsRefreshing(false);
  }, [fetchProfile, fetchPosts, username]);

  /** Infinite scroll */
  const handleLoadMorePosts = useCallback(async () => {
    if (!hasMorePosts || postsLoading || !username || !canViewPosts) return;
    await fetchPosts(username, postsPage + 1);
  }, [canViewPosts, fetchPosts, hasMorePosts, postsLoading, postsPage, username]);

  /** Follow / unfollow toggle */
  const handleFollowToggle = useCallback(async () => {
    if (!profile || followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await followApi.unfollowUser(profile._id);
        setIsFollowing(false);
        // If the account is private, we can no longer see posts
        if (profile.isPrivate) {
          setCanViewPosts(false);
          setPosts([]);
        }
      } else {
        await followApi.followUser(profile._id);
        // For private accounts the follow is pending — posts still hidden
        // For public accounts posts become visible immediately
        if (!profile.isPrivate) {
          setIsFollowing(true);
          setCanViewPosts(true);
          if (username) fetchPosts(username, 1, true);
        } else {
          // Follow request sent — show pending state
          setIsFollowing(true);
        }
      }
    } catch (err: any) {
      console.error('Follow error:', err?.response?.data?.message);
    } finally {
      setFollowLoading(false);
    }
  }, [profile, isFollowing, followLoading, username, fetchPosts]);

  /** Tap on avatar ring — open story viewer */
  const handleAvatarPress = useCallback(() => {
    if (!profile) return;
    const canViewStories = !profile.isPrivate || isFollowing || isOwnProfile;
    if (!canViewStories) {
      Alert.alert('Private Account', 'Follow this account to see their stories.');
      return;
    }
    if (!hasStories) return;
    router.push({ pathname: '/(screens)/story-viewer', params: { userId: profile._id } });
  }, [hasStories, isFollowing, isOwnProfile, profile, router]);

  // ─── Loading / Error ────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Ionicons name="person-outline" size={48} color={colors.textTertiary} />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>User not found</Text>
      </View>
    );
  }

  // ─── Grid helpers ───────────────────────────────────────────

  const renderGridItem = ({ item, index }: { item: MobilePost; index: number }) => {
    const col = index % GRID_COL;
    const hasRightGap = col < GRID_COL - 1;
    const isVideo = item.media[0]?.type === 'video';
    const isMulti = item.media.length > 1;

    return (
      <Pressable
        style={[
          styles.gridItem,
          hasRightGap && { marginRight: GRID_GAP },
          { marginBottom: GRID_GAP },
        ]}
        onPress={() => router.push({ pathname: '/(screens)/post/[id]', params: { id: item._id } })}
      >
        <Image
          source={{ uri: item.media[0]?.thumbnail || item.media[0]?.url || '' }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
        {/* Overlay: video play icon top-right */}
        {isVideo && (
          <View style={styles.gridBadge}>
            <Ionicons name="play" size={12} color={Colors.white} />
          </View>
        )}
        {/* Overlay: multi-image icon top-right */}
        {!isVideo && isMulti && (
          <View style={styles.gridBadge}>
            <Ionicons name="copy-outline" size={12} color={Colors.white} />
          </View>
        )}
      </Pressable>
    );
  };

  const renderPostsFooter = () => {
    if (!postsLoading) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  };

  // ─── Profile header (rendered inside FlatList as ListHeaderComponent) ──

  const renderHeader = () => (
    <View>
      {/* Top header bar */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={HitSlop.md}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{profile.username}</Text>
        <Pressable
          hitSlop={HitSlop.md}
          onPress={() =>
            Share.share({ message: `Check out @${profile.username} on INSTAYT!` })
          }
        >
          <Ionicons name="share-outline" size={20} color={colors.text} />
        </Pressable>
      </View>

      {/* Profile info */}
      <View style={styles.profileSection}>
        {/* Avatar + Stats */}
        <View style={styles.avatarRow}>
          <Pressable
            onPress={handleAvatarPress}
            disabled={!hasStories && (profile.isPrivate && !isFollowing && !isOwnProfile)}
          >
            {hasStories ? (
              <LinearGradient
                colors={allStoriesViewed ? ['#C0C0C0', '#A0A0A0'] : ([...Colors.gradientStory] as any)}
                style={styles.avatarGradient}
              >
                <View style={[styles.avatarInner, { backgroundColor: colors.background }]}>
                  <UserAvatar uri={profile.profilePicture} size="xl" />
                </View>
              </LinearGradient>
            ) : (
              <View style={[styles.avatarGradient, { backgroundColor: colors.border }]}>
                <View style={[styles.avatarInner, { backgroundColor: colors.background }]}>
                  <UserAvatar uri={profile.profilePicture} size="xl" />
                </View>
              </View>
            )}
          </Pressable>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {compactNumber(profile.postsCount)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Posts</Text>
            </View>
            <Pressable
              style={styles.statItem}
              onPress={() =>
                router.push({
                  pathname: '/(screens)/followers',
                  params: { username: profile.username, tab: 'followers' },
                })
              }
            >
              <Text style={[styles.statValue, { color: colors.text }]}>
                {compactNumber(profile.followersCount)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Followers</Text>
            </Pressable>
            <Pressable
              style={styles.statItem}
              onPress={() =>
                router.push({
                  pathname: '/(screens)/followers',
                  params: { username: profile.username, tab: 'following' },
                })
              }
            >
              <Text style={[styles.statValue, { color: colors.text }]}>
                {compactNumber(profile.followingCount)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Following</Text>
            </Pressable>
          </View>
        </View>

        {/* Bio */}
        <View style={styles.bioSection}>
          <Text style={[styles.fullName, { color: colors.text }]}>
            {profile.fullName}
            {profile.isVerified && (
              <Text> <Ionicons name="checkmark-circle" size={14} color={Colors.accent} /></Text>
            )}
          </Text>
          {profile.bio ? (
            <Text style={[styles.bio, { color: colors.textSecondary }]}>{profile.bio}</Text>
          ) : null}
          {profile.website ? (
            <Text style={[styles.website, { color: Colors.accent }]}>{profile.website}</Text>
          ) : null}
          {profile.isFollowedBy && !isOwnProfile && (
            <View style={styles.followsYouBadge}>
              <Text style={[styles.followsYouText, { color: colors.textTertiary }]}>Follows you</Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        {!isOwnProfile && (
          <View style={styles.actionRow}>
            {isFollowing ? (
              <Pressable
                style={[styles.followingBtn, { borderColor: colors.border }]}
                onPress={handleFollowToggle}
                disabled={followLoading}
              >
                {followLoading
                  ? <ActivityIndicator size="small" color={colors.text} />
                  : <Text style={[styles.followingBtnText, { color: colors.text }]}>Following</Text>
                }
              </Pressable>
            ) : (
              <GradientButton
                title="Follow"
                onPress={handleFollowToggle}
                loading={followLoading}
                style={styles.followBtn}
              />
            )}
            <Pressable
              style={[styles.messageBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              onPress={async () => {
                try {
                  const chatApi = await import('../../../src/api/chat.api');
                  const conv = await chatApi.createConversation([String(profile._id).trim()]);
                  router.push({ pathname: '/(screens)/chat/[convId]', params: { convId: conv._id } });
                } catch (err: any) {
                  Alert.alert('Message', err?.message || 'Could not open chat. Try again.');
                }
              }}
            >
              <Text style={[styles.messageBtnText, { color: colors.text }]}>Message</Text>
            </Pressable>
            <Pressable
              style={[styles.iconActionBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              onPress={() => Share.share({ message: `Check out @${profile.username} on INSTAYT!` })}
            >
              <Ionicons name="share-outline" size={18} color={colors.text} />
            </Pressable>
          </View>
        )}
      </View>

      {/* Tab-style divider — just an icon grid indicator */}
      <View style={[styles.gridTabBar, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
        <View style={styles.gridTabActive}>
          <Ionicons name="grid" size={22} color={colors.text} />
        </View>
      </View>

      {/* Private lock wall */}
      {!canViewPosts && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.privateSection}>
          <View style={[styles.lockCircle, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="lock-closed" size={28} color={colors.textTertiary} />
          </View>
          <Text style={[styles.privateTitle, { color: colors.text }]}>This Account is Private</Text>
          <Text style={[styles.privateText, { color: colors.textSecondary }]}>
            Follow to see their photos and videos
          </Text>
        </Animated.View>
      )}
    </View>
  );

  // ─── Render ─────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={canViewPosts ? posts : []}
        renderItem={renderGridItem}
        keyExtractor={(item) => item._id}
        numColumns={GRID_COL}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          canViewPosts && !postsLoading ? (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.emptyGrid}>
              <Ionicons name="camera-outline" size={44} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No posts yet</Text>
            </Animated.View>
          ) : null
        }
        ListFooterComponent={renderPostsFooter}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        onEndReached={handleLoadMorePosts}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.columnWrapper}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  errorText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base },

  // Header bar
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
  },
  headerTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },

  // Profile section
  profileSection: { paddingHorizontal: Spacing.base },
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  avatarGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
    marginRight: Spacing.xl,
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },

  // Stats
  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.lg },
  statLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, marginTop: 2 },

  // Bio
  bioSection: { marginBottom: Spacing.md },
  fullName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base },
  bio: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, marginTop: 4, lineHeight: 20 },
  website: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, marginTop: 2 },
  followsYouBadge: {
    marginTop: Spacing.xs,
    backgroundColor: 'rgba(108,92,231,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radii.xs,
  },
  followsYouText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },

  // Actions
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  followBtn: { flex: 1 },
  followingBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.sm,
    alignItems: 'center',
    borderWidth: 1,
  },
  followingBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  messageBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.sm,
    alignItems: 'center',
    borderWidth: 1,
  },
  messageBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  iconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  // Tab bar (icon-only like Instagram profile)
  gridTabBar: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    marginTop: Spacing.xs,
  },
  gridTabActive: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.white,
  },

  // Private wall
  privateSection: { alignItems: 'center', paddingTop: 48, paddingBottom: 60, gap: Spacing.md },
  lockCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privateTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },
  privateText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.sm,
    textAlign: 'center',
    maxWidth: 220,
  },

  // Grid
  columnWrapper: { marginBottom: 0 },
  gridItem: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  gridBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 99,
    padding: 4,
  },

  // Footer
  emptyGrid: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base },
  footerLoader: { paddingVertical: Spacing.xl, alignItems: 'center' },
});
