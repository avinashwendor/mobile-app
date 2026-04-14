import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  Dimensions, Alert, Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../../src/theme/tokens';
import UserAvatar from '../../../src/components/UserAvatar';
import GradientButton from '../../../src/components/GradientButton';
import { useAuthStore } from '../../../src/stores/authStore';
import * as userApi from '../../../src/api/user.api';
import * as followApi from '../../../src/api/follow.api';
import { compactNumber } from '../../../src/utils/formatters';
import type { UserProfile } from '../../../src/api/user.api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 2;
const GRID_COL = 3;
const TILE_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COL - 1)) / GRID_COL;

export default function UserProfileScreen() {
  const { id: username } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const authUser = useAuthStore((s) => s.user);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (!username) return;
    (async () => {
      try {
        const p = await userApi.getUserProfile(username);
        setProfile(p);
        setIsFollowing(p.isFollowing);
      } catch (err) {
        console.error('Failed to load user:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [username]);

  const handleFollowToggle = useCallback(async () => {
    if (!profile || followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await followApi.unfollowUser(profile._id);
        setIsFollowing(false);
      } else {
        const result = await followApi.followUser(profile._id);
        setIsFollowing(true);
      }
    } catch (err: any) {
      console.error('Follow error:', err?.response?.data?.message);
    } finally {
      setFollowLoading(false);
    }
  }, [profile, isFollowing, followLoading]);

  const isOwnProfile = authUser?.username === username;

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

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={HitSlop.md}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{profile.username}</Text>
        <Pressable hitSlop={HitSlop.md}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
        </Pressable>
      </View>

      {/* Profile info */}
      <View style={styles.profileSection}>
        <View style={styles.avatarRow}>
          <LinearGradient colors={[...Colors.gradientStory]} style={styles.avatarGradient}>
            <View style={[styles.avatarInner, { backgroundColor: colors.background }]}>
              <UserAvatar uri={profile.profilePicture} size="xl" />
            </View>
          </LinearGradient>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{compactNumber(profile.postsCount)}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Posts</Text>
            </View>
            <Pressable
              style={styles.statItem}
              onPress={() => router.push({ pathname: '/(screens)/followers', params: { username: profile.username, tab: 'followers' } })}
            >
              <Text style={[styles.statValue, { color: colors.text }]}>{compactNumber(profile.followersCount)}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Followers</Text>
            </Pressable>
            <Pressable
              style={styles.statItem}
              onPress={() => router.push({ pathname: '/(screens)/followers', params: { username: profile.username, tab: 'following' } })}
            >
              <Text style={[styles.statValue, { color: colors.text }]}>{compactNumber(profile.followingCount)}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Following</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.bioSection}>
          <Text style={[styles.fullName, { color: colors.text }]}>
            {profile.fullName}
            {profile.isVerified && <Text> <Ionicons name="checkmark-circle" size={14} color={Colors.accent} /></Text>}
          </Text>
          {profile.bio ? <Text style={[styles.bio, { color: colors.textSecondary }]}>{profile.bio}</Text> : null}
          {profile.website ? <Text style={[styles.website, { color: Colors.accent }]}>{profile.website}</Text> : null}
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
                <Text style={[styles.followingBtnText, { color: colors.text }]}>Following</Text>
              </Pressable>
            ) : (
              <GradientButton title="Follow" onPress={handleFollowToggle} loading={followLoading} style={styles.followBtn} />
            )}
            <Pressable
              style={[styles.messageBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              onPress={async () => {
                try {
                  const conv = await (await import('../../../src/api/chat.api')).createConversation([profile._id]);
                  router.push({ pathname: '/(screens)/chat/[convId]', params: { convId: conv._id } });
                } catch {}
              }}
            >
              <Text style={[styles.messageBtnText, { color: colors.text }]}>Message</Text>
            </Pressable>
            <Pressable
              style={[styles.iconActionBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              onPress={() => Alert.alert('Audio Call', 'Calling @' + profile.username + '…')}
            >
              <Ionicons name="call-outline" size={18} color={colors.text} />
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

      {/* Post grid */}
      {profile.canViewPosts ? (
        <View style={styles.grid}>
          {profile.recentPosts.length === 0 ? (
            <View style={styles.emptyGrid}>
              <Ionicons name="camera-outline" size={40} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No posts yet</Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {profile.recentPosts.map((post) => (
                <Pressable
                  key={post._id}
                  style={styles.gridItem}
                  onPress={() => router.push({ pathname: '/(screens)/post/[id]', params: { id: post._id } })}
                >
                  <Image source={{ uri: post.media?.[0]?.url }} style={styles.gridImage} contentFit="cover" />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.privateSection}>
          <Ionicons name="lock-closed-outline" size={40} color={colors.textTertiary} />
          <Text style={[styles.privateTitle, { color: colors.text }]}>This Account is Private</Text>
          <Text style={[styles.privateText, { color: colors.textSecondary }]}>Follow to see their posts</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  errorText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingBottom: Spacing.md },
  headerTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },
  profileSection: { paddingHorizontal: Spacing.base },
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  avatarGradient: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', padding: 3, marginRight: Spacing.xl },
  avatarInner: { width: '100%', height: '100%', borderRadius: 40, alignItems: 'center', justifyContent: 'center', padding: 2 },
  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.lg },
  statLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, marginTop: 2 },
  bioSection: { marginBottom: Spacing.md },
  fullName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base },
  bio: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, marginTop: 4, lineHeight: 20 },
  website: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, marginTop: 2 },
  followsYouBadge: { marginTop: Spacing.xs, backgroundColor: 'rgba(108,92,231,0.15)', alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radii.xs },
  followsYouText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  followBtn: { flex: 1 },
  followingBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radii.sm, alignItems: 'center', borderWidth: 1 },
  followingBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  messageBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radii.sm, alignItems: 'center', borderWidth: 1 },
  messageBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  iconActionBtn: { width: 36, height: 36, borderRadius: Radii.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  grid: { minHeight: 200 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: TILE_SIZE, height: TILE_SIZE, marginRight: GRID_GAP, marginBottom: GRID_GAP },
  gridImage: { width: '100%', height: '100%' },
  emptyGrid: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base },
  privateSection: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
  privateTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },
  privateText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base },
});
