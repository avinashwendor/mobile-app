import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Dimensions, FlatList, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, Shadows, AvatarSizes } from '../../src/theme/tokens';
import UserAvatar from '../../src/components/UserAvatar';
import GradientButton from '../../src/components/GradientButton';
import { useAuthStore } from '../../src/stores/authStore';
import * as authApi from '../../src/api/auth.api';
import * as userApi from '../../src/api/user.api';
import * as postApi from '../../src/api/post.api';
import type { SavedFeedItem } from '../../src/api/post.api';
import { compactNumber } from '../../src/utils/formatters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 1;
const GRID_COL = 3;
const TILE_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COL - 1)) / GRID_COL;

type ProfileTab = 'posts' | 'saved';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const authUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [profile, setProfile] = useState(authUser);
  const [posts, setPosts] = useState<any[]>([]);
  const [savedItems, setSavedItems] = useState<SavedFeedItem[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!authUser?.username) return;
    try {
      const [freshUser, postsResult] = await Promise.all([
        authApi.getMe(),
        userApi.getUserPosts(authUser.username, 1, 30),
      ]);
      setProfile(freshUser as any);
      setUser(freshUser as any);
      setPosts(postsResult.posts);
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }, [authUser?.username]);

  const fetchSaved = useCallback(async () => {
    try {
      const result = await postApi.getSavedPosts(1, 30);
      setSavedItems(result.items);
    } catch (err) {
      console.error('Failed to load saved posts:', err);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchProfile();
      setIsLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (activeTab === 'saved' && savedItems.length === 0) {
      fetchSaved();
    }
  }, [activeTab, savedItems.length, fetchSaved]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchProfile();
    if (activeTab === 'saved') await fetchSaved();
    setIsRefreshing(false);
  }, [activeTab]);

  const currentPosts = activeTab === 'posts' ? posts : savedItems;

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
            <LinearGradient colors={[...Colors.gradientStory]} style={styles.avatarGradient}>
              <View style={[styles.avatarInner, { backgroundColor: colors.background }]}>
                <UserAvatar uri={profile?.profilePicture} size="xl" />
              </View>
            </LinearGradient>
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
          {profile?.website ? (
            <Text style={[styles.website, { color: Colors.accent }]}>{profile.website}</Text>
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
            onPress={() => router.push('/(screens)/settings')}
          >
            <Text style={[styles.actionBtnText, { color: colors.text }]}>Settings</Text>
          </Pressable>
        </View>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <Pressable style={[styles.tab, activeTab === 'posts' && styles.tabActive]} onPress={() => setActiveTab('posts')}>
          <Ionicons name="grid-outline" size={22} color={activeTab === 'posts' ? colors.text : colors.textTertiary} />
        </Pressable>
        <Pressable style={[styles.tab, activeTab === 'saved' && styles.tabActive]} onPress={() => setActiveTab('saved')}>
          <Ionicons name="bookmark-outline" size={22} color={activeTab === 'saved' ? colors.text : colors.textTertiary} />
        </Pressable>
      </View>

      {/* Post grid */}
      <View style={styles.grid}>
        {currentPosts.length === 0 ? (
          <View style={styles.emptyGrid}>
            <Ionicons name={activeTab === 'posts' ? 'camera-outline' : 'bookmark-outline'} size={40} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {activeTab === 'posts' ? 'No posts yet' : 'No saved posts'}
            </Text>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {activeTab === 'posts'
              ? posts.map((post: any, index: number) => {
                const isLastInRow = (index + 1) % GRID_COL === 0;
                return (
                  <Pressable
                    key={post._id}
                    style={[styles.gridItem, !isLastInRow && { marginRight: GRID_GAP }]}
                    onPress={() => router.push({ pathname: '/(screens)/post/[id]', params: { id: post._id } })}
                  >
                    <Image
                      source={{ uri: post.media?.[0]?.thumbnail || post.media?.[0]?.url }}
                      style={styles.gridImage}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                    {post.media?.length > 1 && (
                      <View style={styles.multiIndicator}>
                        <Ionicons name="copy-outline" size={12} color={Colors.white} />
                      </View>
                    )}
                  </Pressable>
                );
              })
              : savedItems.map((item, index) => {
                const isLastInRow = (index + 1) % GRID_COL === 0;
                const thumb = item.kind === 'post'
                  ? (item.post.media?.[0]?.thumbnail || item.post.media?.[0]?.url)
                  : (item.reel.video?.thumbnail || item.reel.video?.url);
                const multi = item.kind === 'post' && (item.post.media?.length ?? 0) > 1;
                return (
                  <Pressable
                    key={item.saveId}
                    style={[styles.gridItem, !isLastInRow && { marginRight: GRID_GAP }]}
                    onPress={() => {
                      if (item.kind === 'post') {
                        router.push({ pathname: '/(screens)/post/[id]', params: { id: item.post._id } });
                      } else {
                        router.push({ pathname: '/(tabs)/reels', params: { startReelId: item.reel._id } });
                      }
                    }}
                  >
                    <Image
                      source={{ uri: thumb || '' }}
                      style={styles.gridImage}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                    {item.kind === 'reel' ? (
                      <View style={styles.multiIndicator}>
                        <Ionicons name="film-outline" size={12} color={Colors.white} />
                      </View>
                    ) : null}
                    {multi ? (
                      <View style={[styles.multiIndicator, { right: 4, left: undefined }]}>
                        <Ionicons name="copy-outline" size={12} color={Colors.white} />
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
  avatarWrapper: { marginRight: Spacing.xl },
  avatarGradient: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', padding: 3 },
  avatarInner: { width: '100%', height: '100%', borderRadius: 40, alignItems: 'center', justifyContent: 'center', padding: 2 },
  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.lg },
  statLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, marginTop: 2 },
  bioSection: { marginBottom: Spacing.md },
  fullName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base },
  bio: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, marginTop: 4, lineHeight: 20 },
  website: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  actionBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radii.sm, alignItems: 'center', borderWidth: 1 },
  actionBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  tabBar: { flexDirection: 'row', borderBottomWidth: 0.5 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  grid: { flex: 1 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: TILE_SIZE, height: TILE_SIZE, marginBottom: GRID_GAP },
  gridImage: { width: '100%', height: '100%' },
  multiIndicator: { position: 'absolute', top: 4, right: 4 },
  emptyGrid: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base },
});
