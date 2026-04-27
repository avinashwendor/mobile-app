import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, Modal, ScrollView, TextInput,
  Keyboard, Platform, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Video, ResizeMode, Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Colors, Typography, Spacing, HitSlop } from '../../src/theme/tokens';
import UserAvatar from '../../src/components/UserAvatar';
import ShareSheet from '../../src/components/ShareSheet';
import * as storyApi from '../../src/api/story.api';
import * as chatApi from '../../src/api/chat.api';
import { useAuthStore } from '../../src/stores/authStore';
import { timeAgo } from '../../src/utils/formatters';
import type { Story, StoryGroup, StoryInsights } from '../../src/api/story.api';

type ViewerPosition = {
  groupIndex: number;
  storyIndex: number;
};

const getNextPosition = (groups: StoryGroup[], position: ViewerPosition): ViewerPosition | null => {
  const currentGroup = groups[position.groupIndex];
  if (!currentGroup) return null;
  if (position.storyIndex < currentGroup.stories.length - 1) {
    return { groupIndex: position.groupIndex, storyIndex: position.storyIndex + 1 };
  }
  if (position.groupIndex < groups.length - 1) {
    return { groupIndex: position.groupIndex + 1, storyIndex: 0 };
  }
  return null;
};

const getPrevPosition = (groups: StoryGroup[], position: ViewerPosition): ViewerPosition | null => {
  const currentGroup = groups[position.groupIndex];
  if (!currentGroup) return null;
  if (position.storyIndex > 0) {
    return { groupIndex: position.groupIndex, storyIndex: position.storyIndex - 1 };
  }
  if (position.groupIndex > 0) {
    const previousGroup = groups[position.groupIndex - 1];
    return {
      groupIndex: position.groupIndex - 1,
      storyIndex: Math.max(0, previousGroup.stories.length - 1),
    };
  }
  return null;
};

const markViewed = (groups: StoryGroup[], position: ViewerPosition): StoryGroup[] => groups.map((group, groupIndex) => {
  if (groupIndex !== position.groupIndex) return group;
  const stories = group.stories.map((story, storyIndex) => (
    storyIndex === position.storyIndex ? { ...story, hasViewed: true } : story
  ));
  return {
    ...group,
    stories,
    hasViewed: stories.every((story) => story.hasViewed),
  };
});

const updateStoryAtPosition = (
  groups: StoryGroup[],
  position: ViewerPosition,
  updater: (story: Story) => Story,
): StoryGroup[] => groups.map((group, groupIndex) => {
  if (groupIndex !== position.groupIndex) return group;
  return {
    ...group,
    stories: group.stories.map((story, storyIndex) => (
      storyIndex === position.storyIndex ? updater(story) : story
    )),
  };
});

export default function StoryViewerScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authUser = useAuthStore((state) => state.user);

  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [position, setPosition] = useState<ViewerPosition>({ groupIndex: 0, storyIndex: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isReplyFocused, setIsReplyFocused] = useState(false);
  const [isReacting, setIsReacting] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [insights, setInsights] = useState<StoryInsights | null>(null);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const progress = useSharedValue(0);
  const lastStoryIdRef = useRef<string | null>(null);
  const pressStartRef = useRef<number>(0);
  const audioSoundRef = useRef<Audio.Sound | null>(null);
  const replyInputRef = useRef<TextInput>(null);
  /** Threshold in ms: presses shorter than this are "taps" (navigate), longer are "holds" (pause only). */
  const TAP_THRESHOLD_MS = 200;

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setIsLoading(true);
      try {
        const feed = await storyApi.getStoryFeed();
        let groups = feed;
        let startGroupIndex = feed.findIndex((group) => group.author._id === userId);

        if (startGroupIndex === -1) {
          const directStories = await storyApi.getUserStories(userId);
          if (directStories.length > 0) {
            const directGroup: StoryGroup = {
              author: directStories[0].author,
              stories: directStories,
              hasViewed: directStories.every((story) => story.hasViewed),
            };
            groups = authUser?._id === userId ? [directGroup, ...feed] : [directGroup];
            startGroupIndex = 0;
          }
        }

        if (startGroupIndex === -1) startGroupIndex = 0;
        setStoryGroups(groups);
        setPosition({ groupIndex: startGroupIndex, storyIndex: 0 });
      } catch (err) {
        console.error('Failed to load stories:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [authUser?._id, userId]);

  const currentGroup = storyGroups[position.groupIndex];
  const currentStories = currentGroup?.stories ?? [];
  const currentStory = currentStories[position.storyIndex] ?? null;
  const isOwner = currentStory?.author._id === authUser?._id;
  const storyDurationMs = useMemo(() => {
    if (!currentStory) return 5000;
    if (currentStory.media?.type === 'video') {
      return Math.min(currentStory.media.durationMs ?? 15000, 60000);
    }
    return 5000;
  }, [currentStory]);

  const goNext = useCallback(() => {
    // Snap the current bar to 100% so it looks "completed" before we advance
    cancelAnimation(progress);
    progress.value = 1;
    const next = getNextPosition(storyGroups, position);
    if (!next) {
      router.back();
      return;
    }
    setPosition(next);
  }, [position, progress, router, storyGroups]);

  const goPrev = useCallback(() => {
    cancelAnimation(progress);
    progress.value = 0;
    const previous = getPrevPosition(storyGroups, position);
    if (previous) {
      setPosition(previous);
    }
  }, [position, progress, storyGroups]);

  useEffect(() => {
    if (!currentStory) return;
    if (lastStoryIdRef.current !== currentStory._id) {
      lastStoryIdRef.current = currentStory._id;
      progress.value = 0;
      setIsPaused(false);
      setReplyText('');
      setShowInsights(false);
      setInsights(null);
      setInsightsError(null);

      // Text-only stories have no media to load — mark ready immediately
      const isTextOnly = !currentStory.media?.url;
      setIsMediaReady(isTextOnly);

      if (!isOwner) {
        setStoryGroups((prev) => markViewed(prev, position));
        storyApi.viewStory(currentStory._id).catch(() => {});
      }
    }
  }, [currentStory, isOwner, position, progress]);

  // ─── Audio playback ─────────────────────────────────────────
  // Load & play audio when story changes
  useEffect(() => {
    const audioUrl = (currentStory as any)?.audioTrack?.audioUrl ?? null;
    let isCancelled = false;
    (async () => {
      // Stop & unload previous
      if (audioSoundRef.current) {
        await audioSoundRef.current.stopAsync().catch(() => {});
        await audioSoundRef.current.unloadAsync().catch(() => {});
        audioSoundRef.current = null;
      }
      if (!audioUrl || isCancelled) return;
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true, isLooping: true });
        if (isCancelled) { sound.unloadAsync(); return; }
        audioSoundRef.current = sound;
      } catch { /* ignore — audio is decorative */ }
    })();
    return () => {
      isCancelled = true;
      audioSoundRef.current?.stopAsync().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStory?._id]);

  // Pause / resume audio with story hold
  useEffect(() => {
    if (!audioSoundRef.current) return;
    if (isPaused || isReplyFocused) audioSoundRef.current.pauseAsync().catch(() => {});
    else audioSoundRef.current.playAsync().catch(() => {});
  }, [isPaused, isReplyFocused]);

  // Cleanup audio on screen unmount
  useEffect(() => () => {
    audioSoundRef.current?.stopAsync().catch(() => {});
    audioSoundRef.current?.unloadAsync().catch(() => {});
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, (event: any) => {
      const windowHeight = Dimensions.get('window').height;
      const eventHeight = event?.endCoordinates?.height ?? 0;
      const screenY = event?.endCoordinates?.screenY ?? windowHeight;
      const derivedHeight = Math.max(0, windowHeight - screenY);
      setKeyboardHeight(Math.max(eventHeight, derivedHeight));
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  // Only start the progress timer after the media has fully loaded
  useEffect(() => {
    cancelAnimation(progress);
    if (!currentStory || isPaused || isReplyFocused || !isMediaReady) return;
    const remainingDuration = Math.max(200, Math.round(storyDurationMs * (1 - progress.value)));
    progress.value = withTiming(1, { duration: remainingDuration }, (finished) => {
      if (finished) runOnJS(goNext)();
    });

    return () => {
      cancelAnimation(progress);
    };
  }, [currentStory, goNext, isMediaReady, isPaused, isReplyFocused, progress, storyDurationMs]);

  const handlePressIn = useCallback(() => {
    pressStartRef.current = Date.now();
    cancelAnimation(progress);
    setIsPaused(true);
  }, [progress]);

  const handlePressOut = useCallback(() => {
    setIsPaused(false);
  }, []);

  /**
   * Only navigate if the press was a quick tap, not a long hold.
   * Long holds are for pausing; navigation should not fire on release.
   */
  const handleTapLeft = useCallback(() => {
    const elapsed = Date.now() - pressStartRef.current;
    if (elapsed < TAP_THRESHOLD_MS) {
      goPrev();
    }
  }, [goPrev]);

  const handleTapRight = useCallback(() => {
    const elapsed = Date.now() - pressStartRef.current;
    if (elapsed < TAP_THRESHOLD_MS) {
      goNext();
    }
  }, [goNext]);

  const handleLike = useCallback(async () => {
    if (!currentStory || isOwner || currentStory.likedByMe || isReacting) return;

    setIsReacting(true);
    setStoryGroups((prev) => updateStoryAtPosition(prev, position, (story) => ({
      ...story,
      likedByMe: true,
      likesCount: story.likesCount + 1,
      reactionsCount: story.reactionsCount + 1,
    })));

    try {
      await storyApi.reactToStory(currentStory._id);
    } catch (error) {
      setStoryGroups((prev) => updateStoryAtPosition(prev, position, (story) => ({
        ...story,
        likedByMe: false,
        likesCount: Math.max(0, story.likesCount - 1),
        reactionsCount: Math.max(0, story.reactionsCount - 1),
      })));
      Alert.alert('Could not like story', 'Please try again.');
    } finally {
      setIsReacting(false);
    }
  }, [currentStory, isOwner, isReacting, position]);

  const handleSendReply = useCallback(async () => {
    const text = replyText.trim();
    if (!currentStory || !text || isOwner || isSendingReply) return;

    try {
      setIsSendingReply(true);
      const conversation = await chatApi.createConversation([currentStory.author._id], false);
      await chatApi.sendStoryReply(conversation._id, currentStory._id, text);
      setReplyText('');
      replyInputRef.current?.blur();
    } catch (error) {
      Alert.alert('Could not send reply', 'Please try again.');
    } finally {
      setIsSendingReply(false);
    }
  }, [currentStory, isOwner, isSendingReply, replyText]);

  const handleDeleteStory = useCallback(async () => {
    if (!currentStory || !isOwner) return;
    Alert.alert(
      'Delete Story',
      'This story will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await storyApi.deleteStory(currentStory._id);
              // Remove from local state and advance or go back
              const updatedGroups = storyGroups.map((group, gi) => {
                if (gi !== position.groupIndex) return group;
                return {
                  ...group,
                  stories: group.stories.filter((_, si) => si !== position.storyIndex),
                };
              }).filter((group) => group.stories.length > 0);

              if (updatedGroups.length === 0) {
                router.back();
                return;
              }
              setStoryGroups(updatedGroups);
              const newGroupIdx = Math.min(position.groupIndex, updatedGroups.length - 1);
              const newStoryIdx = Math.min(
                position.storyIndex,
                updatedGroups[newGroupIdx].stories.length - 1,
              );
              setPosition({ groupIndex: newGroupIdx, storyIndex: newStoryIdx });
            } catch {
              Alert.alert('Could not delete', 'Please try again.');
            }
          },
        },
      ],
    );
  }, [currentStory, isOwner, position, router, storyGroups]);

  const handleOpenInsights = useCallback(async () => {
    if (!currentStory || !isOwner) return;
    setShowInsights(true);
    setIsInsightsLoading(true);
    setInsightsError(null);
    try {
      const result = await storyApi.getStoryInsights(currentStory._id);
      setInsights(result);
    } catch (error) {
      setInsightsError('Could not load story insights right now.');
    } finally {
      setIsInsightsLoading(false);
    }
  }, [currentStory, isOwner]);

  const handleMediaReady = useCallback(() => {
    setIsMediaReady(true);
  }, []);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  useEffect(() => {
    if (!isLoading && (!currentStory || !currentGroup)) {
      router.back();
    }
  }, [isLoading, currentStory, currentGroup, router]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.white} />
      </View>
    );
  }

  if (!currentStory || !currentGroup) {
    return null;
  }

  return (
    <View style={styles.screen}>
      {currentStory.media?.type === 'video' ? (
        <Video
          key={currentStory._id}
          source={{ uri: currentStory.media.url }}
          style={styles.media}
          resizeMode={ResizeMode.COVER}
          shouldPlay={!isPaused}
          isLooping={false}
          onLoad={handleMediaReady}
        />
      ) : currentStory.media?.url ? (
        <Image
          source={{ uri: currentStory.media.url }}
          style={styles.media}
          contentFit="cover"
          onLoad={handleMediaReady}
        />
      ) : (
        <View style={[styles.media, { backgroundColor: Colors.primary }]}>
          <Text style={styles.textStory}>{currentStory.text?.content}</Text>
        </View>
      )}

      {/* Loading indicator while media is still being fetched */}
      {!isMediaReady && (
        <View style={styles.mediaLoadingOverlay}>
          <ActivityIndicator size="small" color={Colors.white} />
        </View>
      )}

      <LinearGradient colors={['rgba(0,0,0,0.5)', 'transparent']} style={[styles.topOverlay, { paddingTop: insets.top + Spacing.sm }]}> 
        <View style={styles.progressRow}>
          {currentStories.map((story, index) => (
            <View key={story._id || index} style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  index < position.storyIndex
                    ? { width: '100%' }
                    : index === position.storyIndex
                      ? progressStyle
                      : { width: '0%' },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.authorRow}>
          <Pressable
            style={styles.authorInfo}
            onPress={() => router.push({ pathname: '/(screens)/user/[id]', params: { id: currentStory.author.username } })}
          >
            <UserAvatar uri={currentStory.author.profilePicture} size="sm" />
            <Text style={styles.authorName}>{currentStory.author.username}</Text>
            <Text style={styles.storyTime}>{timeAgo(currentStory.createdAt)}</Text>
          </Pressable>
          <View style={styles.headerActions}>
            <Text style={styles.storyCounter}>
              {position.groupIndex + 1}/{storyGroups.length}
            </Text>
            {isOwner && (
              <Pressable onPress={handleDeleteStory} hitSlop={HitSlop.lg}>
                <Ionicons name="trash-outline" size={22} color={Colors.white} />
              </Pressable>
            )}
            <Pressable onPress={() => router.back()} hitSlop={HitSlop.lg}>
              <Ionicons name="close" size={28} color={Colors.white} />
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={[styles.bottomOverlay, { paddingBottom: Math.max(insets.bottom + Spacing.sm, keyboardHeight + Spacing.md) }]}
      >
        {currentStory.text?.content ? (
          <View style={styles.captionChip}>
            <Text style={styles.captionText}>{currentStory.text.content}</Text>
          </View>
        ) : null}

        {/* Audio track banner */}
        {(currentStory as any).audioTrack && (
          <View style={styles.audioBar}>
            <Ionicons name="musical-note" size={13} color={Colors.white} />
            <Text style={styles.audioBarText} numberOfLines={1}>
              {(currentStory as any).audioTrack.title} · {(currentStory as any).audioTrack.artist}
            </Text>
          </View>
        )}

        {isOwner ? (
          <Pressable style={styles.ownerInsightsCard} onPress={handleOpenInsights}>
            <View style={styles.ownerInsightsSummary}>
              <View style={styles.ownerInsightMetric}>
                <Ionicons name="eye-outline" size={18} color={Colors.white} />
                <Text style={styles.ownerInsightMetricText}>{currentStory.viewsCount} views</Text>
              </View>
              <View style={styles.ownerInsightMetric}>
                <Ionicons name="heart-outline" size={18} color={Colors.white} />
                <Text style={styles.ownerInsightMetricText}>{currentStory.likesCount} likes</Text>
              </View>
            </View>
            <Ionicons name="chevron-up" size={18} color={Colors.white} />
          </Pressable>
        ) : (
          <View style={styles.replyBar}>
            <Pressable style={styles.actionIconButton} onPress={handleLike} disabled={currentStory.likedByMe || isReacting}>
              <Ionicons name={currentStory.likedByMe ? 'heart' : 'heart-outline'} size={20} color={currentStory.likedByMe ? Colors.likeFilled : Colors.white} />
            </Pressable>
            <Pressable style={styles.actionIconButton} onPress={() => setShareVisible(true)}>
              <Ionicons name="paper-plane-outline" size={20} color={Colors.white} />
            </Pressable>
            <View style={styles.replyInputShell}>
              <TextInput
                ref={replyInputRef}
                value={replyText}
                onChangeText={setReplyText}
                onFocus={() => setIsReplyFocused(true)}
                onBlur={() => setIsReplyFocused(false)}
                placeholder={`Reply to ${currentStory.author.username}`}
                placeholderTextColor="rgba(255,255,255,0.5)"
                style={styles.replyInput}
                returnKeyType="send"
                onSubmitEditing={handleSendReply}
              />
            </View>
            <Pressable style={[styles.sendButton, !replyText.trim() && styles.sendButtonDisabled]} onPress={handleSendReply} disabled={!replyText.trim() || isSendingReply}>
              <Ionicons name="arrow-up" size={18} color={Colors.white} />
            </Pressable>
          </View>
        )}
      </LinearGradient>

      <View style={styles.tapZones}>
        <Pressable style={styles.tapLeft} onPress={handleTapLeft} onPressIn={handlePressIn} onPressOut={handlePressOut} disabled={isReplyFocused} />
        <Pressable style={styles.tapRight} onPress={handleTapRight} onPressIn={handlePressIn} onPressOut={handlePressOut} disabled={isReplyFocused} />
      </View>

      <ShareSheet
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        contentType="story"
        contentId={currentStory._id}
        message={`Check out ${currentStory.author.username}'s story on INSTAYT.`}
      />

      <Modal visible={showInsights} transparent animationType="slide" onRequestClose={() => setShowInsights(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowInsights(false)}>
          <Pressable style={styles.insightsSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.insightsTitle}>Story Insights</Text>
            {isInsightsLoading ? (
              <ActivityIndicator size="small" color={Colors.white} style={{ marginTop: Spacing.md }} />
            ) : insightsError ? (
              <Text style={styles.insightsError}>{insightsError}</Text>
            ) : insights ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.insightsContent}>
                <View style={styles.insightsStatsRow}>
                  <View style={styles.insightStatCard}>
                    <Text style={styles.insightStatValue}>{insights.viewsCount}</Text>
                    <Text style={styles.insightStatLabel}>Views</Text>
                  </View>
                  <View style={styles.insightStatCard}>
                    <Text style={styles.insightStatValue}>{insights.likesCount}</Text>
                    <Text style={styles.insightStatLabel}>Likes</Text>
                  </View>
                </View>

                <Text style={styles.insightSectionTitle}>People who liked</Text>
                {insights.likes.length === 0 ? (
                  <Text style={styles.emptyInsightText}>No likes yet.</Text>
                ) : insights.likes.map((like) => (
                  <View key={`${like.user._id}-${like.reactedAt}`} style={styles.insightRow}>
                    <UserAvatar uri={like.user.profilePicture} size="sm" />
                    <View style={styles.insightRowContent}>
                      <Text style={styles.insightUsername}>{like.user.username}</Text>
                      <Text style={styles.insightMeta}>{timeAgo(like.reactedAt)}</Text>
                    </View>
                    <Text style={styles.insightEmoji}>{like.emoji}</Text>
                  </View>
                ))}

                <Text style={styles.insightSectionTitle}>People who viewed</Text>
                {insights.viewers.length === 0 ? (
                  <Text style={styles.emptyInsightText}>No viewers yet.</Text>
                ) : insights.viewers.map((viewer) => (
                  <View key={`${viewer.user._id}-${viewer.viewedAt}`} style={styles.insightRow}>
                    <UserAvatar uri={viewer.user.profilePicture} size="sm" />
                    <View style={styles.insightRowContent}>
                      <Text style={styles.insightUsername}>{viewer.user.username}</Text>
                      <Text style={styles.insightMeta}>{timeAgo(viewer.viewedAt)}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  media: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  mediaLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 4,
  },
  textStory: { fontFamily: Typography.fontFamily.bold, fontSize: 28, color: Colors.white, textAlign: 'center', paddingHorizontal: 40 },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: Spacing.md },
  progressRow: { flexDirection: 'row', gap: 3, marginBottom: Spacing.sm },
  progressTrack: { flex: 1, height: 2.5, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.white, borderRadius: 2 },
  authorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  authorInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  authorName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm, color: Colors.white },
  storyTime: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, color: 'rgba(255,255,255,0.7)' },
  storyCounter: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.xs, color: 'rgba(255,255,255,0.7)' },
  bottomOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 15, paddingHorizontal: Spacing.md, paddingTop: Spacing.xl, gap: Spacing.md },
  captionChip: { alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: 16, maxWidth: '88%' },
  captionText: { color: Colors.white, fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm },
  audioBar: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.40)', borderRadius: 20,
    paddingHorizontal: Spacing.sm, paddingVertical: 4, maxWidth: '80%',
  },
  audioBarText: { color: Colors.white, fontFamily: Typography.fontFamily.medium, fontSize: 11, flexShrink: 1 },
  ownerInsightsCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  ownerInsightsSummary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  ownerInsightMetric: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ownerInsightMetricText: { color: Colors.white, fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  actionIconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  replyInputShell: { flex: 1, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: Spacing.md },
  replyInput: { color: Colors.white, fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, minHeight: 42 },
  sendButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },
  sendButtonDisabled: { opacity: 0.45 },
  tapZones: { ...StyleSheet.absoluteFillObject, bottom: 116, flexDirection: 'row', zIndex: 5 },
  tapLeft: { flex: 1 },
  tapRight: { flex: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  insightsSheet: { backgroundColor: '#111111', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: Spacing.xl, maxHeight: '72%' },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: Spacing.md },
  insightsTitle: { color: Colors.white, fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.lg },
  insightsError: { color: 'rgba(255,255,255,0.7)', fontFamily: Typography.fontFamily.regular, marginTop: Spacing.md },
  insightsContent: { paddingTop: Spacing.md, paddingBottom: Spacing.lg, gap: Spacing.md },
  insightsStatsRow: { flexDirection: 'row', gap: Spacing.sm },
  insightStatCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18, padding: Spacing.md },
  insightStatValue: { color: Colors.white, fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.xl },
  insightStatLabel: { color: 'rgba(255,255,255,0.7)', fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.xs, marginTop: 4 },
  insightSectionTitle: { color: Colors.white, fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base, marginTop: Spacing.sm },
  emptyInsightText: { color: 'rgba(255,255,255,0.65)', fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 18, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
  insightRowContent: { flex: 1 },
  insightUsername: { color: Colors.white, fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  insightMeta: { color: 'rgba(255,255,255,0.65)', fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, marginTop: 2 },
  insightEmoji: { color: Colors.white, fontSize: Typography.size.base },
});
