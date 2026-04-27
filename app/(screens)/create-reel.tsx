import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, HitSlop, Radii, Spacing, Typography } from '../../src/theme/tokens';
import * as reelApi from '../../src/api/reel.api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STAGE_WIDTH = SCREEN_WIDTH - Spacing.base * 2;
const STAGE_HEIGHT = Math.min(STAGE_WIDTH * (16 / 9), 520); // 9:16 capped

type VideoAsset = {
  uri: string;
  mimeType: string;
  width: number;
  height: number;
  duration?: number;
};

const MAX_CAPTION = 2200;
const MAX_REEL_DURATION = 90_000; // 90 seconds
const REEL_PICKER_QUALITY = 0.62;
const IOS_VIDEO_MEDIUM_QUALITY = (ImagePicker as any).UIImagePickerControllerQualityType?.Medium;
const IOS_VIDEO_MEDIUM_PRESET = (ImagePicker as any).VideoExportPreset?.MediumQuality;

function extractHashtags(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(/#([\p{L}0-9_]+)/gu)).map((m) => m[1])));
}

export default function CreateReelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [video, setVideo] = useState<VideoAsset | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const progress = useSharedValue(0);

  const hashtags = useMemo(() => extractHashtags(caption), [caption]);
  const canShare = video !== null && !isUploading;

  const progressStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, progress.value)) * 100}%`,
  }));

  const pickVideo = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'We need access to your photos to create a reel.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: false,
      quality: REEL_PICKER_QUALITY,
      videoMaxDuration: 90,
      exif: false,
      ...(IOS_VIDEO_MEDIUM_QUALITY ? { videoQuality: IOS_VIDEO_MEDIUM_QUALITY } : {}),
      ...(IOS_VIDEO_MEDIUM_PRESET ? { videoExportPreset: IOS_VIDEO_MEDIUM_PRESET } : {}),
    });
    if (result.canceled || !result.assets.length) return;
    const a = result.assets[0];
    if (a.type !== 'video') {
      Alert.alert('Videos only', 'Reels must be video clips.');
      return;
    }
    if (a.duration && a.duration > MAX_REEL_DURATION) {
      Alert.alert('90-second maximum', 'Reels can be up to 90 seconds. Please choose a shorter clip.');
      return;
    }
    setVideo({
      uri: a.uri,
      mimeType: a.mimeType ?? 'video/mp4',
      width: a.width ?? 1080,
      height: a.height ?? 1920,
      duration: a.duration ?? undefined,
    });
  }, []);

  const captureVideo = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Camera unavailable', 'Enable camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: REEL_PICKER_QUALITY,
      videoMaxDuration: 90,
      ...(IOS_VIDEO_MEDIUM_QUALITY ? { videoQuality: IOS_VIDEO_MEDIUM_QUALITY } : {}),
    });
    if (result.canceled || !result.assets.length) return;
    const a = result.assets[0];
    setVideo({
      uri: a.uri,
      mimeType: a.mimeType ?? 'video/mp4',
      width: a.width ?? 1080,
      height: a.height ?? 1920,
      duration: a.duration ?? undefined,
    });
  }, []);

  const handleShare = useCallback(async () => {
    if (!canShare || !video) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsUploading(true);
      progress.value = withTiming(0.15, { duration: 300 });
      const interval = setInterval(() => {
        progress.value = withTiming(Math.min(0.88, progress.value + 0.06), { duration: 500 });
      }, 600);
      try {
        await reelApi.createReel({
          videoUri: video.uri,
          caption: caption.trim(),
          hashtags,
        });
        progress.value = withTiming(1, { duration: 250 });
        setTimeout(() => router.replace('/'), 250);
      } finally {
        clearInterval(interval);
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Could not share reel', err?.message ?? 'Upload failed. Please try again.');
      progress.value = withTiming(0, { duration: 200 });
    } finally {
      setIsUploading(false);
    }
  }, [canShare, caption, hashtags, progress, router, video]);

  const handleClose = useCallback(() => {
    if (!video && !caption.trim()) { router.back(); return; }
    Alert.alert('Discard reel?', 'Your draft will not be saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  }, [caption, router, video]);

  const formatDuration = (ms: number) => {
    const s = Math.round(ms / 1000);
    return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <Pressable onPress={handleClose} hitSlop={HitSlop.md} style={styles.headerBtn}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>New Reel</Text>
        <Pressable
          onPress={handleShare}
          disabled={!canShare}
          hitSlop={HitSlop.md}
          style={[styles.headerAction, !canShare && { opacity: 0.35 }]}
        >
          <Text style={[styles.headerActionText, { color: Colors.emerald }]}>
            {isUploading ? 'Sharing…' : 'Share'}
          </Text>
        </Pressable>
      </View>

      {/* Progress Rail */}
      {isUploading && (
        <View style={styles.progressRail} pointerEvents="none">
          <Animated.View style={[styles.progressFill, progressStyle]}>
            <LinearGradient
              colors={[...Colors.gradientAccent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Video Stage */}
          {!video ? (
            <Animated.View
              entering={FadeIn.duration(260)}
              style={[
                styles.emptyStage,
                { backgroundColor: isDark ? colors.surface : colors.surfaceHover, borderColor: colors.border },
              ]}
            >
              <LinearGradient
                colors={[isDark ? 'rgba(9,132,227,0.15)' : 'rgba(9,132,227,0.07)', 'transparent']}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(9,132,227,0.1)' }]}>
                <Ionicons name="film-outline" size={36} color={Colors.accent} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Create a Reel</Text>
              <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                Vertical video up to 90 seconds
              </Text>
              <View style={styles.emptyActions}>
                <Pressable onPress={pickVideo} style={styles.primaryBtn}>
                  <LinearGradient
                    colors={[...Colors.gradientAccent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons name="videocam-outline" size={18} color={Colors.white} />
                  <Text style={styles.primaryBtnText}>Choose video</Text>
                </Pressable>
                <Pressable onPress={captureVideo} style={[styles.secondaryBtn, { borderColor: colors.border }]}>
                  <Ionicons name="camera-outline" size={18} color={colors.text} />
                  <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Record</Text>
                </Pressable>
              </View>
              {/* Tips */}
              <View style={styles.tips}>
                {['Vertical 9:16 recommended', 'Up to 90 seconds', 'MP4 or MOV format'].map((tip) => (
                  <View key={tip} style={styles.tipRow}>
                    <Ionicons name="checkmark-circle-outline" size={14} color={Colors.accent} />
                    <Text style={[styles.tipText, { color: colors.textTertiary }]}>{tip}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(220)} style={styles.stageWrapper}>
              <View style={[styles.stage, { backgroundColor: Colors.black }]}>
                <Image
                  source={{ uri: video.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
                {/* Video overlay info */}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.6)']}
                  style={styles.stageOverlay}
                  pointerEvents="none"
                />
                <View style={styles.videoInfo}>
                  <View style={styles.videoInfoBadge}>
                    <Ionicons name="videocam" size={13} color={Colors.white} />
                    <Text style={styles.videoInfoText}>
                      {video.duration ? formatDuration(video.duration) : 'Video'}
                    </Text>
                  </View>
                  {video.width && video.height && (
                    <View style={styles.videoInfoBadge}>
                      <Text style={styles.videoInfoText}>
                        {video.width}×{video.height}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Replace / Remove */}
                <Pressable style={styles.removeChip} onPress={() => setVideo(null)}>
                  <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
                  <Ionicons name="trash-outline" size={15} color={Colors.white} />
                </Pressable>
              </View>

              {/* Replace button */}
              <Pressable
                onPress={pickVideo}
                style={[styles.replaceRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Ionicons name="refresh-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.replaceText, { color: colors.textSecondary }]}>Replace video</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Caption */}
          <View style={styles.section}>
            <View style={[styles.captionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Write a caption… Use # for hashtags"
                placeholderTextColor={colors.textTertiary}
                style={[styles.captionInput, { color: colors.text }]}
                multiline
                maxLength={MAX_CAPTION}
                textAlignVertical="top"
              />
              <View style={styles.captionFoot}>
                <View style={styles.hashtagChips}>
                  {hashtags.slice(0, 5).map((tag) => (
                    <View key={tag} style={styles.hashChip}>
                      <Text style={styles.hashChipText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[styles.counter, { color: colors.textTertiary }]}>
                  {caption.length}/{MAX_CAPTION}
                </Text>
              </View>
            </View>
          </View>

          {/* Hashtag tips */}
          {hashtags.length === 0 && caption.length === 0 && (
            <Animated.View entering={FadeInDown.duration(200)} style={styles.section}>
              <View style={[styles.hashtagTip, { backgroundColor: isDark ? 'rgba(9,132,227,0.08)' : 'rgba(9,132,227,0.06)', borderColor: isDark ? 'rgba(9,132,227,0.2)' : 'rgba(9,132,227,0.15)' }]}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.accent} />
                <Text style={[styles.hashtagTipText, { color: colors.textSecondary }]}>
                  Add hashtags to reach more people
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Share Button */}
          <View style={[styles.section, { paddingBottom: Spacing.md }]}>
            <Pressable
              onPress={handleShare}
              disabled={!canShare}
              style={[styles.shareBtn, !canShare && { opacity: 0.45 }]}
            >
              <LinearGradient
                colors={[...Colors.gradientAccent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              {isUploading ? (
                <>
                  <Ionicons name="cloud-upload-outline" size={19} color={Colors.white} />
                  <Text style={styles.shareBtnText}>Sharing…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="film-outline" size={19} color={Colors.white} />
                  <Text style={styles.shareBtnText}>Share Reel</Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { padding: Spacing.xs },
  headerTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.md },
  headerAction: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  headerActionText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base },

  progressRail: { height: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 1 },

  scroll: { paddingHorizontal: Spacing.base },

  emptyStage: {
    marginTop: Spacing.base,
    height: STAGE_HEIGHT + 80,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    overflow: 'hidden',
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md, marginBottom: 6 },
  emptyHint: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, textAlign: 'center', marginBottom: Spacing.xl },
  emptyActions: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radii.full,
    overflow: 'hidden',
  },
  primaryBtnText: { color: Colors.white, fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  secondaryBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  tips: { gap: 8 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },

  stageWrapper: { marginTop: Spacing.base, gap: Spacing.md },
  stage: {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    borderRadius: Radii.xl,
    overflow: 'hidden',
  },
  stageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  videoInfo: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    flexDirection: 'row',
    gap: 6,
  },
  videoInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  videoInfoText: { color: Colors.white, fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.xs },
  removeChip: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  replaceText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.xs },

  section: { marginTop: Spacing.xl },

  captionCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.md },
  captionInput: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.base,
    minHeight: 72,
    lineHeight: 22,
  },
  captionFoot: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm },
  hashtagChips: { flexDirection: 'row', gap: 6, flex: 1, flexWrap: 'wrap' },
  hashChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.full, backgroundColor: 'rgba(9,132,227,0.12)' },
  hashChipText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.xs, color: Colors.accent },
  counter: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },

  hashtagTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  hashtagTipText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, flex: 1 },

  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 52,
    borderRadius: Radii.full,
    overflow: 'hidden',
  },
  shareBtnText: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.base,
    letterSpacing: 0.3,
  },
});
