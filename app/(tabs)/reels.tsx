import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, Dimensions,
  ActivityIndicator, FlatList, RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing } from '../../src/theme/tokens';
import UserAvatar from '../../src/components/UserAvatar';
import CommentsSheet from '../../src/components/comments/CommentsSheet';
import ShareSheet from '../../src/components/ShareSheet';
import * as reelApi from '../../src/api/reel.api';
import * as likeApi from '../../src/api/like.api';
import { compactNumber } from '../../src/utils/formatters';
import type { Reel } from '../../src/api/reel.api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ReelsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useTheme();
  const params = useLocalSearchParams<{ startReelId?: string | string[]; openComments?: string | string[]; commentId?: string | string[] }>();
  const startReelId = Array.isArray(params.startReelId) ? params.startReelId[0] : params.startReelId;
  const openCommentsParam = Array.isArray(params.openComments) ? params.openComments[0] : params.openComments;
  const highlightCommentId = Array.isArray(params.commentId) ? params.commentId[0] : params.commentId;

  const [reels, setReels] = useState<Reel[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentSheetReelId, setCommentSheetReelId] = useState<string | null>(null);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [shareSheetReelId, setShareSheetReelId] = useState<string | null>(null);
  const listRef = useRef<FlatList<Reel>>(null);

  const fetchReels = useCallback(async (pageNum: number, refresh = false) => {
    try {
      const result = await reelApi.getReelsFeed(pageNum, 5);
      if (refresh) {
        setReels(result.reels);
      } else {
        setReels((prev) => [...prev, ...result.reels]);
      }
      setHasMore(result.hasMore);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to load reels:', err);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchReels(1, true);
      setIsLoading(false);
    })();
  }, [fetchReels]);

  useEffect(() => {
    if (!startReelId || reels.length === 0) return;
    const i = reels.findIndex((r) => r._id === startReelId);
    if (i < 0) return;
    setActiveIndex(i);
    const t = setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({ index: i, animated: false });
      } catch {
        listRef.current?.scrollToOffset({ offset: i * SCREEN_HEIGHT, animated: false });
      }
    }, 120);
    return () => clearTimeout(t);
  }, [startReelId, reels]);

  useEffect(() => {
    if (openCommentsParam !== '1' || !startReelId || reels.length === 0) return;
    if (reels.some((reel) => reel._id === startReelId)) {
      setCommentSheetReelId(startReelId);
    }
  }, [openCommentsParam, reels, startReelId]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchReels(1, true);
    setIsRefreshing(false);
  }, [fetchReels]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || isRefreshing) return;
    setIsLoadingMore(true);
    await fetchReels(page + 1);
    setIsLoadingMore(false);
  }, [fetchReels, hasMore, isLoadingMore, isRefreshing, page]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: '#000' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header overlay */}
      <View style={[styles.headerOverlay, { paddingTop: insets.top + Spacing.sm }]}>
        <Text style={styles.headerTitle}>Reels</Text>
        <Pressable onPress={() => router.push('/(tabs)/create')}>
          <Ionicons name="camera-outline" size={26} color={Colors.white} />
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={reels}
        renderItem={({ item, index }) => (
          <ReelItem
            reel={item}
            isActive={index === activeIndex}
            insets={insets}
            router={router}
            onCommentPress={(reelId) => {
              setCommentsExpanded(false);
              setCommentSheetReelId(reelId);
            }}
            onSharePress={(reelId) => setShareSheetReelId(reelId)}
            isPlaybackPaused={commentsExpanded && commentSheetReelId === item._id}
          />
        )}
        keyExtractor={(item) => item._id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        onScrollToIndexFailed={({ index }) => {
          listRef.current?.scrollToOffset({ offset: index * SCREEN_HEIGHT, animated: false });
        }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={2}
        ListFooterComponent={isLoadingMore ? <ActivityIndicator color={Colors.white} style={{ marginVertical: 16 }} /> : null}
        ListEmptyComponent={
          <View style={[styles.center, { height: SCREEN_HEIGHT }]}>
            <Ionicons name="videocam-outline" size={48} color={Colors.dark.textTertiary} />
            <Text style={styles.emptyText}>No reels yet</Text>
          </View>
        }
      />

      {commentSheetReelId && (
        <CommentsSheet
          visible={!!commentSheetReelId}
          contentType="reel"
          contentId={commentSheetReelId}
          onClose={() => {
            setCommentSheetReelId(null);
            setCommentsExpanded(false);
          }}
          initialExpanded={false}
          highlightCommentId={highlightCommentId}
          onExpandedChange={setCommentsExpanded}
        />
      )}

      {shareSheetReelId && (
        <ShareSheet
          visible={!!shareSheetReelId}
          onClose={() => setShareSheetReelId(null)}
          contentType="reel"
          contentId={shareSheetReelId}
        />
      )}
    </View>
  );
}

function ReelItem({
  reel,
  isActive,
  insets,
  router,
  onCommentPress,
  onSharePress,
  isPlaybackPaused,
}: {
  reel: Reel;
  isActive: boolean;
  insets: any;
  router: any;
  onCommentPress: (reelId: string) => void;
  onSharePress: (reelId: string) => void;
  isPlaybackPaused: boolean;
}) {
  const [isLiked, setIsLiked] = useState(Boolean(reel.isLiked));
  const [likeCount, setLikeCount] = useState(reel.likesCount);
  const [videoReady, setVideoReady] = useState(false);
  const prevReelIdRef = useRef(reel._id);

  useEffect(() => {
    setIsLiked(Boolean(reel.isLiked));
    setLikeCount(reel.likesCount);
  }, [reel._id, reel.isLiked, reel.likesCount]);

  // Reset video-ready state only when the reel changes or becomes inactive
  useEffect(() => {
    if (!isActive || prevReelIdRef.current !== reel._id) {
      setVideoReady(false);
      prevReelIdRef.current = reel._id;
    }
  }, [isActive, reel._id]);

  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartOpacity.value,
  }));

  let lastTap = 0;
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      if (!isLiked) handleLike();
      heartScale.value = withSequence(
        withSpring(1.4, { damping: 6 }),
        withTiming(0, { duration: 600 }),
      );
      heartOpacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 800 }),
      );
    }
    lastTap = now;
  };

  const handleLike = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount((c) => wasLiked ? c - 1 : c + 1);
    try {
      if (wasLiked) {
        await likeApi.unlikeContent('reel', reel._id);
      } else {
        await likeApi.likeContent('reel', reel._id);
      }
    } catch {
      setIsLiked(wasLiked);
      setLikeCount((c) => wasLiked ? c + 1 : c - 1);
    }
  };

  const videoUri = reel.video?.url;
  const thumbUri = reel.video?.thumbnail || videoUri;

  return (
    <Pressable onPress={handleDoubleTap} style={[styles.reelContainer, { height: SCREEN_HEIGHT }]}>
      {/* Thumbnail always anchors layout; video fades in when the first frame is ready (avoids black flash). */}
      {!isActive || !videoUri ? (
        <Image
          source={{ uri: thumbUri || undefined }}
          style={styles.reelVideo}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
        />
      ) : (
        <View style={styles.reelVideo}>
          {/* Thumbnail stays visible until the video is ready — prevents black frame flash */}
          <Image
            source={{ uri: thumbUri || undefined }}
            style={[StyleSheet.absoluteFillObject, { opacity: videoReady ? 0 : 1 }]}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <Video
            source={{ uri: videoUri }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: SCREEN_WIDTH,
              height: SCREEN_HEIGHT,
              opacity: videoReady ? 1 : 0,
            }}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isActive && !isPlaybackPaused}
            isLooping
            isMuted={false}
            useNativeControls={false}
            onLoad={() => setVideoReady(true)}
          />

          {/* Loading spinner while the video is buffering */}
          {!videoReady && (
            <View style={styles.videoLoadingOverlay}>
              <ActivityIndicator size="large" color={Colors.white} />
            </View>
          )}
        </View>
      )}

      {/* Double-tap heart */}
      <Animated.View style={[styles.doubleTapHeart, heartStyle]}>
        <Ionicons name="heart" size={100} color={Colors.white} />
      </Animated.View>

      {/* Bottom overlay */}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.bottomGradient}>
        <View style={[styles.reelBottom, { paddingBottom: insets.bottom + 80 }]}>
          <View style={styles.reelInfo}>
            <Pressable
              style={styles.reelAuthor}
              onPress={() => router.push({ pathname: '/(screens)/user/[id]', params: { id: reel.author.username } })}
            >
              <UserAvatar uri={reel.author.profilePicture} size="sm" />
              <Text style={styles.reelUsername}>@{reel.author.username}</Text>
              {reel.author.isVerified && <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />}
            </Pressable>
            {reel.caption ? <Text style={styles.reelCaption} numberOfLines={2}>{reel.caption}</Text> : null}
            {reel.audio?.title && (
              <View style={styles.audioRow}>
                <Ionicons name="musical-notes" size={12} color={Colors.white} />
                <Text style={styles.audioText} numberOfLines={1}>{reel.audio.title}</Text>
              </View>
            )}
          </View>

          {/* Side actions */}
          <View style={styles.sideActions}>
            <Pressable style={styles.sideAction} onPress={handleLike}>
              <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={28} color={isLiked ? Colors.likeFilled : Colors.white} />
              <Text style={styles.sideActionText}>{compactNumber(likeCount)}</Text>
            </Pressable>
            <Pressable
              style={styles.sideAction}
              onPress={() => onCommentPress(reel._id)}
            >
              <Ionicons name="chatbubble-outline" size={26} color={Colors.white} />
              <Text style={styles.sideActionText}>{compactNumber(reel.commentsCount)}</Text>
            </Pressable>
            <Pressable style={styles.sideAction} onPress={() => onSharePress(reel._id)}>
              <Ionicons name="paper-plane-outline" size={26} color={Colors.white} />
              <Text style={styles.sideActionText}>Share</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base },
  headerTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.xl, color: Colors.white },
  reelContainer: { width: SCREEN_WIDTH },
  videoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  reelVideo: { ...StyleSheet.absoluteFillObject },
  doubleTapHeart: { position: 'absolute', top: '40%', alignSelf: 'center', zIndex: 10 },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 300 },
  reelBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: Spacing.base, flex: 1 },
  reelInfo: { flex: 1, marginRight: Spacing.lg },
  reelAuthor: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  reelUsername: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.base, color: Colors.white },
  reelCaption: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, color: Colors.white, marginBottom: Spacing.sm },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  audioText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, color: 'rgba(255,255,255,0.8)', maxWidth: 180 },
  sideActions: { alignItems: 'center', gap: Spacing.lg },
  sideAction: { alignItems: 'center', gap: 4 },
  sideActionText: { fontFamily: Typography.fontFamily.medium, fontSize: 11, color: Colors.white },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base, color: Colors.dark.textTertiary, marginTop: Spacing.md },
});
