import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Dimensions, RefreshControl, Linking, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../../src/theme/tokens';
import UserAvatar from '../../src/components/UserAvatar';
import { useAuthStore } from '../../src/stores/authStore';
import * as authApi from '../../src/api/auth.api';
import * as storyApi from '../../src/api/story.api';
import * as userApi from '../../src/api/user.api';
import type { MobilePost, MobileReel } from '../../src/api/adapters';
import { compactNumber } from '../../src/utils/formatters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 1;
const GRID_COL = 3;
const TILE_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COL - 1)) / GRID_COL;

type ProfileTab = 'all' | 'reels' | 'network';
type GridItemSource = 'owner' | 'collab' | 'tagged';

type GridItem = {
  key: string;
  id: string;
  kind: 'post' | 'reel';
  source: GridItemSource;
  createdAt: string;
  previewUrl: string;
  hasMultipleMedia: boolean;
};

const EMPTY_PROFILE_MEDIA: userApi.MyProfileMedia = {
  ownPosts: [],
  ownReels: [],
  collaboratedPosts: [],
  collaboratedReels: [],
  taggedPosts: [],
  taggedReels: [],
};

const SOURCE_PRIORITY: Record<GridItemSource, number> = {
  owner: 0,
  collab: 1,
  tagged: 2,
};

const formatLinkLabel = (link: string) => link
  .replace(/^https?:\/\//i, '')
  .replace(/\/$/, '');

const sortGridItems = (items: GridItem[]) => items.sort(
  (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
);

const upsertGridItem = (bucket: Map<string, GridItem>, item: GridItem) => {
  const existing = bucket.get(item.key);
  if (!existing || SOURCE_PRIORITY[item.source] > SOURCE_PRIORITY[existing.source]) {
    bucket.set(item.key, item);
  }
};

const buildPostGridItem = (post: MobilePost, source: GridItemSource): GridItem => ({
  key: `post:${post._id}`,
  id: post._id,
  kind: 'post',
  source,
  createdAt: post.createdAt,
  previewUrl: post.media?.[0]?.thumbnail || post.media?.[0]?.url || '',
  hasMultipleMedia: (post.media?.length ?? 0) > 1,
});

/** Derive a Cloudinary image thumbnail from a Cloudinary video URL (client-side fallback). */
const getCloudinaryThumbnail = (url: string): string => {
  if (!url || !url.includes('cloudinary')) return url;
  // swap /upload/ with transformation + so_0 (first frame)
  return url
    .replace('/upload/', '/upload/w_400,h_600,c_fill,g_auto,q_auto,so_0/')
    // change video extension to jpg
    .replace(/\.(mp4|mov|webm|avi)(\?.*)?$/, '.jpg');
};

const buildReelGridItem = (reel: MobileReel, source: GridItemSource): GridItem => ({
  key: `reel:${reel._id}`,
  id: reel._id,
  kind: 'reel',
  source,
  createdAt: reel.createdAt,
  previewUrl: reel.video.thumbnail || getCloudinaryThumbnail(reel.video.url) || reel.video.url || '',
  hasMultipleMedia: false,
});

const buildDashboardBuckets = (media: userApi.MyProfileMedia) => {
  const all = new Map<string, GridItem>();
  const reels = new Map<string, GridItem>();
  const network = new Map<string, GridItem>();

  for (const post of media.ownPosts) upsertGridItem(all, buildPostGridItem(post, 'owner'));
  for (const reel of media.ownReels) {
    const item = buildReelGridItem(reel, 'owner');
    upsertGridItem(all, item);
    upsertGridItem(reels, item);
  }

  for (const post of media.collaboratedPosts) {
    const item = buildPostGridItem(post, 'collab');
    upsertGridItem(all, item);
    upsertGridItem(network, item);
  }
  for (const reel of media.collaboratedReels) {
    const item = buildReelGridItem(reel, 'collab');
    upsertGridItem(all, item);
    upsertGridItem(network, item);
  }

  for (const post of media.taggedPosts) upsertGridItem(network, buildPostGridItem(post, 'tagged'));
  for (const reel of media.taggedReels) upsertGridItem(network, buildReelGridItem(reel, 'tagged'));

  return {
    all: sortGridItems(Array.from(all.values())),
    reels: sortGridItems(Array.from(reels.values())),
    network: sortGridItems(Array.from(network.values())),
  };
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const authUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [profile, setProfile] = useState(authUser);
  const [profileMedia, setProfileMedia] = useState<userApi.MyProfileMedia>(EMPTY_PROFILE_MEDIA);
  const [ownStories, setOwnStories] = useState<storyApi.Story[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!authUser?.username) return;
    try {
      const [freshUser, mediaResult, feedGroups] = await Promise.all([
        authApi.getMe(),
        userApi.getMyProfileMedia(90),
        authUser?._id ? storyApi.getStoryFeed().catch(() => []) : Promise.resolve([]),
      ]);
      setProfile(freshUser as any);
      setUser(freshUser as any);
      setProfileMedia(mediaResult);
      // Own stories are always included in the feed — find our group
      const ownGroup = feedGroups.find((g: storyApi.StoryGroup) => g.author._id === authUser?._id);
      setOwnStories(ownGroup?.stories ?? []);
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }, [authUser?._id, authUser?.username, setUser]);

  useEffect(() => {
    (async () => {
      await fetchProfile();
      setIsLoading(false);
    })();
  }, [fetchProfile]);

  useFocusEffect(
    useCallback(() => {
      if (isLoading) return undefined;
      fetchProfile();
    }, [fetchProfile, isLoading]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchProfile();
    setIsRefreshing(false);
  }, [fetchProfile]);

  const profileLinks = Array.from(new Set([
    profile?.website,
    ...(profile?.socialLinks ?? []),
  ].filter(Boolean))) as string[];
  const dashboardBuckets = buildDashboardBuckets(profileMedia);
  const currentItems = dashboardBuckets[activeTab];

  const handleOpenLink = useCallback(async (link: string) => {
    try {
      await Linking.openURL(link);
    } catch (err) {
      console.warn('Failed to open profile link:', err);
    }
  }, []);

  const handleShareProfile = useCallback(async () => {
    const shareLines = [`Check out @${profile?.username ?? ''} on INSTAYT.`];
    if (profileLinks[0]) shareLines.push(profileLinks[0]);

    try {
      await Share.share({ message: shareLines.filter(Boolean).join('\n') });
    } catch (err) {
      console.warn('Failed to share profile:', err);
    }
  }, [profile?.username, profileLinks]);

  const handleCreateStory = useCallback(() => {
    router.push('/(screens)/create-story');
  }, [router]);

  const handleOpenOwnStory = useCallback(() => {
    if (authUser?._id) {
      router.push({ pathname: '/(screens)/story-viewer', params: { userId: authUser._id } });
    }
  }, [authUser?._id, router]);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Text style={[styles.headerUsername, { color: colors.text }]}>
          {profile?.username}
          {profile?.isVerified && (
            <Text> <Ionicons name="checkmark-circle" size={16} color={Colors.accent} /></Text>
          )}
        </Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/(screens)/settings')} style={styles.headerBtn}>
            <Ionicons name="menu-outline" size={28} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Profile info */}
      <View style={styles.profileSection}>
        <View style={styles.avatarRow}>
          <View style={styles.avatarWrapper}>
            <Pressable onPress={handleOpenOwnStory}>
              <LinearGradient
                colors={ownStories.length > 0 ? [...Colors.gradientStory] : [colors.border, colors.border]}
                style={styles.avatarGradient}
              >
                <View style={[styles.avatarInner, { backgroundColor: colors.background }]}> 
                  <UserAvatar uri={profile?.profilePicture} size="xl" />
                </View>
              </LinearGradient>
            </Pressable>
            <Pressable style={styles.avatarAddStoryButton} onPress={handleCreateStory}>
              <LinearGradient colors={[...Colors.gradientPrimary]} style={styles.avatarAddStoryFill}>
                <Ionicons name="add" size={16} color={Colors.white} />
              </LinearGradient>
            </Pressable>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <Pressable style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{compactNumber(profile?.postsCount || 0)}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Posts</Text>
            </Pressable>
            <Pressable
              style={styles.statItem}
              onPress={() => router.push({ pathname: '/(screens)/followers', params: { username: profile?.username, tab: 'followers' } })}
            >
              <Text style={[styles.statValue, { color: colors.text }]}>{compactNumber(profile?.followersCount || 0)}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Followers</Text>
            </Pressable>
            <Pressable
              style={styles.statItem}
              onPress={() => router.push({ pathname: '/(screens)/followers', params: { username: profile?.username, tab: 'following' } })}
            >
              <Text style={[styles.statValue, { color: colors.text }]}>{compactNumber(profile?.followingCount || 0)}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Following</Text>
            </Pressable>
          </View>
        </View>

        {/* Bio */}
        <View style={styles.bioSection}>
          <Text style={[styles.fullName, { color: colors.text }]}>{profile?.fullName}</Text>
          {profile?.bio ? (
            <Text style={[styles.bio, { color: colors.textSecondary }]}>{profile.bio}</Text>
          ) : null}
          {profileLinks.length > 0 ? (
            <View style={styles.linksWrap}>
              {profileLinks.map((link) => (
                <Pressable
                  key={link}
                  style={[styles.linkChip, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                  onPress={() => handleOpenLink(link)}
                >
                  <Ionicons name="link-outline" size={14} color={Colors.accent} />
                  <Text style={[styles.linkChipText, { color: Colors.accent }]} numberOfLines={1}>{formatLinkLabel(link)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            onPress={() => router.push('/(screens)/edit-profile')}
          >
            <Text style={[styles.actionBtnText, { color: colors.text }]}>Edit Profile</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            onPress={handleShareProfile}
          >
            <Text style={[styles.actionBtnText, { color: colors.text }]}>Share Profile</Text>
          </Pressable>
        </View>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <Pressable style={[styles.tab, activeTab === 'all' && styles.tabActive]} onPress={() => setActiveTab('all')}>
          <Ionicons name="grid-outline" size={20} color={activeTab === 'all' ? colors.text : colors.textTertiary} />
          <Text style={[styles.tabLabel, { color: activeTab === 'all' ? colors.text : colors.textTertiary }]}>All</Text>
        </Pressable>
        <Pressable style={[styles.tab, activeTab === 'reels' && styles.tabActive]} onPress={() => setActiveTab('reels')}>
          <Ionicons name="film-outline" size={20} color={activeTab === 'reels' ? colors.text : colors.textTertiary} />
          <Text style={[styles.tabLabel, { color: activeTab === 'reels' ? colors.text : colors.textTertiary }]}>Reels</Text>
        </Pressable>
        <Pressable style={[styles.tab, activeTab === 'network' && styles.tabActive]} onPress={() => setActiveTab('network')}>
          <Ionicons name="people-outline" size={20} color={activeTab === 'network' ? colors.text : colors.textTertiary} />
          <Text style={[styles.tabLabel, { color: activeTab === 'network' ? colors.text : colors.textTertiary }]}>Tagged</Text>
        </Pressable>
      </View>

      {/* Post grid */}
      <View style={styles.grid}>
        {currentItems.length === 0 ? (
          <View style={styles.emptyGrid}>
            <Ionicons
              name={activeTab === 'reels' ? 'film-outline' : activeTab === 'network' ? 'people-outline' : 'camera-outline'}
              size={40}
              color={colors.textTertiary}
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {activeTab === 'all'
                ? 'No posts or reels yet'
                : activeTab === 'reels'
                  ? 'No reels yet'
                  : 'No collaborated or tagged items yet'}
            </Text>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {currentItems.map((item, index) => {
              const isLastInRow = (index + 1) % GRID_COL === 0;
              return (
                <Pressable
                  key={item.key}
                  style={[styles.gridItem, !isLastInRow && { marginRight: GRID_GAP }]}
                  onPress={() => {
                    if (item.kind === 'post') {
                      router.push({ pathname: '/(screens)/post/[id]', params: { id: item.id } });
                    } else {
                      router.push({ pathname: '/(tabs)/reels', params: { startReelId: item.id } });
                    }
                  }}
                >
                  <Image
                    source={{ uri: item.previewUrl || '' }}
                    style={styles.gridImage}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                  {item.kind === 'reel' ? (
                    <View style={styles.reelPlayOverlay}>
                      <View style={styles.reelPlayBtn}>
                        <Ionicons name="play" size={18} color={Colors.white} />
                      </View>
                    </View>
                  ) : null}
                  {item.hasMultipleMedia ? (
                    <View style={[styles.gridBadge, styles.gridBadgeRight]}>
                      <Ionicons name="copy-outline" size={12} color={Colors.white} />
                    </View>
                  ) : null}
                  {item.source !== 'owner' ? (
                    <View style={[styles.gridBadge, styles.gridBadgeBottom]}>
                      <Ionicons
                        name={item.source === 'tagged' ? 'at-outline' : 'people-outline'}
                        size={12}
                        color={Colors.white}
                      />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  headerUsername: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.lg },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  headerBtn: { padding: Spacing.xs },
  profileSection: { paddingHorizontal: Spacing.base },
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  avatarWrapper: { marginRight: Spacing.xl, position: 'relative' },
  avatarGradient: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', padding: 3 },
  avatarInner: { width: '100%', height: '100%', borderRadius: 40, alignItems: 'center', justifyContent: 'center', padding: 2 },
  avatarAddStoryButton: { position: 'absolute', right: -4, bottom: -4, borderRadius: 16, overflow: 'hidden' },
  avatarAddStoryFill: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0A0A0F' },
  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.lg },
  statLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, marginTop: 2 },
  bioSection: { marginBottom: Spacing.md },
  fullName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base },
  bio: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, marginTop: 4, lineHeight: 20 },
  linksWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
  linkChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: Radii.pill, paddingHorizontal: Spacing.sm, paddingVertical: 6, maxWidth: '100%' },
  linkChipText: { flexShrink: 1, fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.xs },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  actionBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radii.sm, alignItems: 'center', borderWidth: 1 },
  actionBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  tabBar: { flexDirection: 'row', borderBottomWidth: 0.5 },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.xs },
  grid: { flex: 1 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: TILE_SIZE, height: TILE_SIZE, marginBottom: GRID_GAP },
  gridImage: { width: '100%', height: '100%' },
  gridBadge: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, padding: 4 },
  gridBadgeLeft: { top: 4, left: 4 },
  gridBadgeRight: { top: 4, right: 4 },
  gridBadgeBottom: { bottom: 4, right: 4 },
  reelPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelPlayBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
    // shift slightly right so the play icon looks visually centered
    paddingLeft: 3,
  },
  emptyGrid: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base },
});
