import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, Dimensions, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../src/theme/tokens';
import UserAvatar from '../../src/components/UserAvatar';
import * as storyApi from '../../src/api/story.api';
import { timeAgo } from '../../src/utils/formatters';
import type { Story } from '../../src/api/story.api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function StoryViewerScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [stories, setStories] = useState<Story[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const s = await storyApi.getUserStories(userId);
        setStories(s);
      } catch (err) {
        console.error('Failed to load stories:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [userId]);

  const currentStory = stories[currentIndex];

  const goNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((i) => i + 1);
      progress.value = 0;
    } else {
      router.back();
    }
  }, [currentIndex, stories.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      progress.value = 0;
    }
  }, [currentIndex]);

  useEffect(() => {
    if (!currentStory) return;
    const duration = currentStory.media?.type === 'video' ? 15000 : 5000;
    progress.value = 0;
    progress.value = withTiming(1, { duration }, (finished) => {
      if (finished) runOnJS(goNext)();
    });

    // Mark as viewed
    storyApi.getStory(currentStory._id).catch(() => {});
  }, [currentIndex, currentStory]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.white} />
      </View>
    );
  }

  if (!currentStory) {
    router.back();
    return null;
  }

  return (
    <View style={styles.screen}>
      {/* Story media */}
      {currentStory.media?.type === 'video' ? (
        <Video
          source={{ uri: currentStory.media.url }}
          style={styles.media}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping={false}
        />
      ) : currentStory.media?.url ? (
        <Image source={{ uri: currentStory.media.url }} style={styles.media} contentFit="cover" />
      ) : (
        <View style={[styles.media, { backgroundColor: Colors.primary }]}>
          <Text style={styles.textStory}>{currentStory.text?.content}</Text>
        </View>
      )}

      {/* Top overlay */}
      <LinearGradient colors={['rgba(0,0,0,0.5)', 'transparent']} style={[styles.topOverlay, { paddingTop: insets.top + Spacing.sm }]}>
        {/* Progress bars */}
        <View style={styles.progressRow}>
          {stories.map((_, i) => (
            <View key={i} style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  i < currentIndex ? { width: '100%' } : i === currentIndex ? progressStyle : { width: '0%' },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Author info */}
        <View style={styles.authorRow}>
          <Pressable style={styles.authorInfo} onPress={() => router.push({ pathname: '/(screens)/user/[id]', params: { id: currentStory.author.username } })}>
            <UserAvatar uri={currentStory.author.profilePicture} size="sm" />
            <Text style={styles.authorName}>{currentStory.author.username}</Text>
            <Text style={styles.storyTime}>{timeAgo(currentStory.createdAt)}</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} hitSlop={HitSlop.lg}>
            <Ionicons name="close" size={28} color={Colors.white} />
          </Pressable>
        </View>
      </LinearGradient>

      {/* Tap zones */}
      <View style={styles.tapZones}>
        <Pressable style={styles.tapLeft} onPress={goPrev} />
        <Pressable style={styles.tapRight} onPress={goNext} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  media: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  textStory: { fontFamily: Typography.fontFamily.bold, fontSize: 28, color: Colors.white, textAlign: 'center', paddingHorizontal: 40 },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: Spacing.md },
  progressRow: { flexDirection: 'row', gap: 3, marginBottom: Spacing.sm },
  progressTrack: { flex: 1, height: 2.5, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.white, borderRadius: 2 },
  authorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  authorInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  authorName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm, color: Colors.white },
  storyTime: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, color: 'rgba(255,255,255,0.7)' },
  tapZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 5 },
  tapLeft: { flex: 1 },
  tapRight: { flex: 2 },
});
