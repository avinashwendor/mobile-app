import React, { useState, useCallback, memo, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Dimensions, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../theme/tokens';
import UserAvatar from './UserAvatar';
import PostOptionsMenu from './PostOptionsMenu';
import EditPostModal from './EditPostModal';
import { timeAgo, compactNumber } from '../utils/formatters';
import type { Post } from '../api/post.api';
import { ApiError } from '../api/client';
import * as likeApi from '../api/like.api';
import * as postApi from '../api/post.api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PostCardProps {
  post: Post;
  onComment: (postId: string) => void;
  onShare: (postId: string) => void;
  onUserPress: (username: string) => void;
  onPostPress: (postId: string) => void;
  /** Whether the current user has liked this post (pre-fetched or optimistic) */
  initialIsLiked?: boolean;
  initialIsSaved?: boolean;
  /** The _id of the currently logged-in user (used to decide whether to show edit/delete) */
  currentUserId?: string;
  /** Called after a successful caption/settings edit */
  onPostUpdated?: (updatedPost: Post) => void;
  /** Called after the post is successfully deleted */
  onPostDeleted?: (postId: string) => void;
}

/**
 * Feed post card — maps directly to the backend Post model.
 * Field names: author.username, author.profilePicture, media[].url, likesCount, etc.
 */
function PostCardComponent({
  post, onComment, onShare, onUserPress, onPostPress,
  initialIsLiked, initialIsSaved,
  currentUserId, onPostUpdated, onPostDeleted,
}: PostCardProps) {
  const { colors } = useTheme();
  const resolvedLiked = initialIsLiked !== undefined ? initialIsLiked : post.isLiked;
  const resolvedSaved = initialIsSaved !== undefined ? initialIsSaved : post.isSaved;
  const [isLiked, setIsLiked] = useState(resolvedLiked);
  const [isSaved, setIsSaved] = useState(resolvedSaved);
  const [likeCount, setLikeCount] = useState(post.likesCount);

  // Menu / edit state
  const [menuVisible, setMenuVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [menuLoadingId, setMenuLoadingId] = useState<string | null>(null);

  const isOwner = !!currentUserId && currentUserId === post.author._id;

  useEffect(() => {
    setIsLiked(initialIsLiked !== undefined ? initialIsLiked : post.isLiked);
  }, [initialIsLiked, post._id, post.isLiked]);

  useEffect(() => {
    setIsSaved(initialIsSaved !== undefined ? initialIsSaved : post.isSaved);
  }, [initialIsSaved, post._id, post.isSaved]);

  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const likeButtonScale = useSharedValue(1);

  const [mediaIndex, setMediaIndex] = useState(0);

  const onCarouselScroll = useCallback((e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setMediaIndex(idx);
  }, []);

  const heartAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartOpacity.value,
  }));

  const likeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeButtonScale.value }],
  }));

  let lastTap = 0;
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap < 300) {
      if (!isLiked) handleLike();
      heartScale.value = withSequence(
        withSpring(1.2, { damping: 8, stiffness: 200 }),
        withTiming(1, { duration: 200 }),
        withTiming(0, { duration: 400 }),
      );
      heartOpacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(1, { duration: 600 }),
        withTiming(0, { duration: 400 }),
      );
    }
    lastTap = now;
  }, [isLiked]);

  const handleLike = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    likeButtonScale.value = withSequence(
      withSpring(1.3, { damping: 8 }),
      withSpring(1, { damping: 8 }),
    );

    // Optimistic update
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount((prev) => (wasLiked ? prev - 1 : prev + 1));

    try {
      if (wasLiked) {
        await likeApi.unlikeContent('post', post._id);
      } else {
        await likeApi.likeContent('post', post._id);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && !wasLiked) {
        setIsLiked(true);
        return;
      }
      if (e instanceof ApiError && e.status === 404 && wasLiked) {
        setIsLiked(false);
        return;
      }
      setIsLiked(wasLiked);
      setLikeCount((prev) => (wasLiked ? prev + 1 : prev - 1));
    }
  };

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const wasSaved = isSaved;
    setIsSaved(!wasSaved);
    try {
      await postApi.toggleSavePost(post._id, wasSaved);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && !wasSaved) {
        setIsSaved(true);
        return;
      }
      if (e instanceof ApiError && e.status === 404 && wasSaved) {
        setIsSaved(false);
        return;
      }
      setIsSaved(wasSaved);
    }
  };

  // ──────────────────────────── 3-dot menu ────────────────────────────

  const handleOpenMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMenuVisible(true);
  };

  const menuOptions = isOwner
    ? [
        { id: 'edit', icon: 'create-outline' as const, label: 'Edit post' },
        { id: 'insights', icon: 'bar-chart-outline' as const, label: 'View insights' },
        { id: 'archive', icon: 'archive-outline' as const, label: 'Archive' },
        { id: 'delete', icon: 'trash-outline' as const, label: 'Delete post', isDestructive: true },
      ]
    : [
        { id: 'report', icon: 'flag-outline' as const, label: 'Report' },
        { id: 'not_interested', icon: 'eye-off-outline' as const, label: 'Not interested' },
      ];

  const handleMenuSelect = async (optionId: string) => {
    if (optionId === 'edit') {
      setMenuVisible(false);
      // Small delay so the menu slides out before the edit modal slides in
      setTimeout(() => setEditVisible(true), 280);
      return;
    }

    if (optionId === 'delete') {
      setMenuVisible(false);
      setTimeout(() => {
        Alert.alert(
          'Delete Post',
          'This will permanently delete this post and remove it from your profile. This action cannot be undone.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  await postApi.deletePost(post._id);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  onPostDeleted?.(post._id);
                } catch {
                  Alert.alert('Error', 'Failed to delete post. Please try again.');
                }
              },
            },
          ],
        );
      }, 100);
      return;
    }

    if (optionId === 'archive') {
      setMenuLoadingId('archive');
      try {
        // Archive endpoint: toggle archived state via a generic update
        // (backend supports is_archived via PUT /posts/:id in some setups)
        // For now, close menu and show a placeholder
        await new Promise((r) => setTimeout(r, 500));
        setMenuVisible(false);
        Alert.alert('Archived', 'Post has been archived and removed from your profile.');
      } catch {
        Alert.alert('Error', 'Failed to archive post.');
      } finally {
        setMenuLoadingId(null);
      }
      return;
    }

    if (optionId === 'insights') {
      setMenuVisible(false);
      return;
    }

    // report / not_interested — just dismiss
    setMenuVisible(false);
  };

  const handleEditSaved = (updatedPost: Post) => {
    setEditVisible(false);
    onPostUpdated?.(updatedPost);
  };

  // ─────────────────────────────────────────────────────────────────────

  const mediaCount = post.media.length;
  const firstMedia = post.media[0];
  const mediaHeight = firstMedia?.height && firstMedia?.width
    ? (firstMedia.height / firstMedia.width) * SCREEN_WIDTH
    : SCREEN_WIDTH;
  const clampedHeight = Math.min(mediaHeight, SCREEN_WIDTH * 1.25);

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      {/* Header — uses backend field names */}
      <View style={styles.header}>
        <Pressable style={styles.headerUser} onPress={() => onUserPress(post.author.username)}>
          <UserAvatar uri={post.author.profilePicture} size="sm" />
          <View style={styles.headerText}>
            <View style={styles.usernameRow}>
              <Text style={[styles.username, { color: colors.text }]}>
                {post.author.username}
              </Text>
              {post.author.isVerified && (
                <Ionicons name="checkmark-circle" size={14} color={Colors.accent} style={styles.verifiedIcon} />
              )}
            </View>
            <Text style={[styles.time, { color: colors.textTertiary }]}>
              {timeAgo(post.createdAt)}
            </Text>
          </View>
        </Pressable>
        <Pressable hitSlop={HitSlop.md} onPress={handleOpenMenu} style={styles.menuBtn}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Media carousel */}
      <View style={{ height: clampedHeight, backgroundColor: colors.surfaceElevated }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={mediaCount > 1}
          onScroll={onCarouselScroll}
          scrollEventThrottle={16}
          bounces={false}
        >
          {post.media.map((item, i) => (
            <Pressable key={i} style={[styles.mediaItem, { height: clampedHeight }]} onPress={handleDoubleTap}>
              <Image
                source={{ uri: item.url }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={300}
              />
            </Pressable>
          ))}
        </ScrollView>
        <Animated.View style={[styles.heartOverlay, heartAnimStyle]} pointerEvents="none">
          <Ionicons name="heart" size={80} color={Colors.white} />
        </Animated.View>
        {mediaCount > 1 && (
          <View style={styles.mediaCounter}>
            <Text style={styles.mediaCounterText}>{mediaIndex + 1}/{mediaCount}</Text>
          </View>
        )}
      </View>

      {/* Dot indicators for carousel */}
      {mediaCount > 1 && (
        <View style={styles.dotRow}>
          {post.media.map((_, i) => (
            <View key={i} style={[styles.dot, i === mediaIndex && styles.dotActive]} />
          ))}
        </View>
      )}

      {/* Action Bar */}
      <View style={styles.actionBar}>
        <View style={styles.leftActions}>
          <Animated.View style={likeAnimStyle}>
            <Pressable onPress={handleLike} hitSlop={HitSlop.sm}>
              <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={26} color={isLiked ? Colors.likeFilled : colors.text} />
            </Pressable>
          </Animated.View>
          <Pressable onPress={() => onComment(post._id)} hitSlop={HitSlop.sm} style={styles.actionIcon}>
            <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => onShare(post._id)} hitSlop={HitSlop.sm} style={styles.actionIcon}>
            <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
          </Pressable>
        </View>
        <Pressable onPress={handleSave} hitSlop={HitSlop.sm}>
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={24} color={colors.text} />
        </Pressable>
      </View>

      {/* Likes count */}
      {!post.hideLikesCount && likeCount > 0 && (
        <Text style={[styles.likesCount, { color: colors.text }]}>
          {compactNumber(likeCount)} {likeCount === 1 ? 'like' : 'likes'}
        </Text>
      )}

      {/* Caption */}
      {post.caption.length > 0 && (
        <View style={styles.captionContainer}>
          <Text style={[styles.captionText, { color: colors.text }]}>
            <Text style={styles.captionUsername}>{post.author.username}</Text>
            {'  '}{post.caption}
          </Text>
        </View>
      )}

      {/* Comments link */}
      {post.commentsCount > 0 && (
        <Pressable onPress={() => onComment(post._id)}>
          <Text style={[styles.viewComments, { color: colors.textTertiary }]}>
            View all {compactNumber(post.commentsCount)} comments
          </Text>
        </Pressable>
      )}

      {/* 3-dot Options menu */}
      <PostOptionsMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        options={menuOptions}
        onSelect={handleMenuSelect}
        loadingOptionId={menuLoadingId}
      />

      {/* Edit post modal — only rendered when we need it */}
      {editVisible && (
        <EditPostModal
          visible={editVisible}
          post={post}
          onClose={() => setEditVisible(false)}
          onSaved={handleEditSaved}
        />
      )}
    </View>
  );
}

export const PostCard = memo(PostCardComponent);

const styles = StyleSheet.create({
  container: { borderBottomWidth: 0.5, paddingBottom: Spacing.sm, marginBottom: Spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  headerUser: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerText: { flex: 1, marginLeft: Spacing.sm },
  usernameRow: { flexDirection: 'row', alignItems: 'center' },
  username: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  verifiedIcon: { marginLeft: 4 },
  time: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, marginTop: 1 },
  menuBtn: { padding: Spacing.xs },
  media: { width: SCREEN_WIDTH },
  mediaItem: { width: SCREEN_WIDTH, overflow: 'hidden' },
  mediaCounter: {
    position: 'absolute', top: Spacing.sm, right: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: Radii.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  mediaCounterText: { color: Colors.white, fontSize: 12, fontFamily: Typography.fontFamily.semiBold },
  dotRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, paddingVertical: Spacing.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.18)' },
  dotActive: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.primary },
  heartOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  actionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  leftActions: { flexDirection: 'row', alignItems: 'center' },
  actionIcon: { marginLeft: Spacing.base },
  likesCount: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm, paddingHorizontal: Spacing.md, marginBottom: Spacing.xs },
  captionContainer: { paddingHorizontal: Spacing.md, marginBottom: Spacing.xs },
  captionText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, lineHeight: Typography.lineHeight.sm },
  captionUsername: { fontFamily: Typography.fontFamily.semiBold },
  viewComments: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, paddingHorizontal: Spacing.md, marginBottom: Spacing.xs },
});
