import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, HitSlop, Radii, Spacing, Typography } from '../../src/theme/tokens';
import * as postApi from '../../src/api/post.api';
import * as userApi from '../../src/api/user.api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STAGE_WIDTH = SCREEN_WIDTH - Spacing.base * 2;
const STAGE_HEIGHT = STAGE_WIDTH; // 1:1 square for posts

type MediaAsset = {
  uri: string;
  type: 'image' | 'video';
  mimeType: string;
  width: number;
  height: number;
  duration?: number;
};
type Visibility = 'public' | 'followers' | 'private';

const VISIBILITY_OPTIONS: { value: Visibility; label: string; icon: keyof typeof Ionicons.glyphMap; hint: string }[] = [
  { value: 'public', label: 'Everyone', icon: 'globe-outline', hint: 'Anyone on Instayt' },
  { value: 'followers', label: 'Followers', icon: 'people-outline', hint: 'People who follow you' },
  { value: 'private', label: 'Only me', icon: 'lock-closed-outline', hint: 'Saved privately' },
];

const MAX_CAPTION = 2200;

function extractTokens(text: string) {
  const hashtags = Array.from(new Set(Array.from(text.matchAll(/#([\p{L}0-9_]+)/gu)).map((m) => m[1])));
  const mentions = Array.from(new Set(Array.from(text.matchAll(/@([a-zA-Z0-9_.]+)/g)).map((m) => m[1])));
  return { hashtags, mentions };
}

export default function CreatePostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [likesVisible, setLikesVisible] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<userApi.UserSearchResult[]>([]);

  const progress = useSharedValue(0);
  const listRef = useRef<FlatList<MediaAsset>>(null);
  const mentionRef = useRef(0);

  const tokens = useMemo(() => extractTokens(caption), [caption]);
  const canShare = media.length > 0 && !isUploading;

  const progressStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, progress.value)) * 100}%`,
  }));

  const pickMedia = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'We need access to your photos to create a post.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.85,
      videoMaxDuration: 60,
      exif: false,
    });
    if (result.canceled || !result.assets.length) return;
    const assets: MediaAsset[] = result.assets.map((a) => ({
      uri: a.uri,
      type: a.type === 'video' ? 'video' : 'image',
      mimeType: a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      width: a.width ?? 1080,
      height: a.height ?? 1080,
      duration: a.duration ?? undefined,
    }));
    setMedia(assets);
    setActiveIndex(0);
  }, []);

  const captureMedia = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Camera unavailable', 'Enable camera access in Settings to capture media.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (result.canceled || !result.assets.length) return;
    const a = result.assets[0];
    const asset: MediaAsset = {
      uri: a.uri,
      type: a.type === 'video' ? 'video' : 'image',
      mimeType: a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      width: a.width ?? 1080,
      height: a.height ?? 1080,
      duration: a.duration ?? undefined,
    };
    setMedia((prev) => [...prev, asset].slice(0, 10));
    setActiveIndex(media.length);
  }, [media.length]);

  const removeMedia = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMedia((prev) => prev.filter((_, i) => i !== index));
    setActiveIndex((prev) => Math.max(0, Math.min(prev, media.length - 2)));
  }, [media.length]);

  const handleCaptionChange = useCallback((value: string) => {
    setCaption(value);
    const lastToken = value.split(/\s/).pop() ?? '';
    if (lastToken.startsWith('@') && lastToken.length > 1) {
      const query = lastToken.slice(1);
      const id = ++mentionRef.current;
      userApi.searchUsers(query, 1, 5).then((res) => {
        if (id === mentionRef.current) setMentionSuggestions(res.users);
      }).catch(() => {
        if (id === mentionRef.current) setMentionSuggestions([]);
      });
    } else if (mentionSuggestions.length) {
      setMentionSuggestions([]);
    }
  }, [mentionSuggestions.length]);

  const applyMention = useCallback((username: string) => {
    Haptics.selectionAsync();
    setCaption((prev) => {
      const parts = prev.split(/\s/);
      parts[parts.length - 1] = `@${username} `;
      return parts.join(' ');
    });
    setMentionSuggestions([]);
  }, []);

  const handleShare = useCallback(async () => {
    if (!canShare) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsUploading(true);
      progress.value = withTiming(0.15, { duration: 300 });
      const interval = setInterval(() => {
        progress.value = withTiming(Math.min(0.88, progress.value + 0.07), { duration: 400 });
      }, 500);
      try {
        await postApi.createPost({
          caption: caption.trim(),
          mediaFiles: media.map((m) => ({ uri: m.uri, type: m.mimeType })),
          location: location.trim() || undefined,
          visibility,
          commentsEnabled,
          likesVisible,
        });
        progress.value = withTiming(1, { duration: 250 });
        setTimeout(() => router.replace('/'), 250);
      } finally {
        clearInterval(interval);
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Could not share', err?.message ?? 'Upload failed. Please try again.');
      progress.value = withTiming(0, { duration: 200 });
    } finally {
      setIsUploading(false);
    }
  }, [canShare, caption, commentsEnabled, likesVisible, location, media, progress, router, visibility]);

  const handleClose = useCallback(() => {
    if (!media.length && !caption.trim()) { router.back(); return; }
    Alert.alert('Discard post?', 'Your draft will not be saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  }, [caption, media.length, router]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <Pressable onPress={handleClose} hitSlop={HitSlop.md} style={styles.headerBtn}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>New Post</Text>
        <Pressable
          onPress={handleShare}
          disabled={!canShare}
          hitSlop={HitSlop.md}
          style={[styles.headerAction, !canShare && { opacity: 0.35 }]}
        >
          <Text style={[styles.headerActionText, { color: Colors.accent }]}>
            {isUploading ? 'Sharing…' : 'Share'}
          </Text>
        </Pressable>
      </View>

      {/* Progress Rail */}
      {isUploading && (
        <View style={styles.progressRail} pointerEvents="none">
          <Animated.View style={[styles.progressFill, progressStyle]}>
            <LinearGradient
              colors={[...Colors.gradientPrimary]}
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
          {/* Media Stage */}
          {media.length === 0 ? (
            <Animated.View
              entering={FadeIn.duration(260)}
              style={[
                styles.emptyStage,
                {
                  backgroundColor: isDark ? colors.surface : colors.surfaceHover,
                  borderColor: colors.border,
                },
              ]}
            >
              <LinearGradient
                colors={[isDark ? 'rgba(108,92,231,0.15)' : 'rgba(108,92,231,0.07)', 'transparent']}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(108,92,231,0.1)' }]}>
                <Ionicons name="images-outline" size={36} color={Colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Add to your post</Text>
              <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                Photos and videos, up to 10 items
              </Text>
              <View style={styles.emptyActions}>
                <Pressable onPress={pickMedia} style={styles.primaryBtn}>
                  <LinearGradient
                    colors={[...Colors.gradientPrimary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons name="images-outline" size={18} color={Colors.white} />
                  <Text style={styles.primaryBtnText}>Choose from library</Text>
                </Pressable>
                <Pressable onPress={captureMedia} style={[styles.secondaryBtn, { borderColor: colors.border }]}>
                  <Ionicons name="camera-outline" size={18} color={colors.text} />
                  <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Camera</Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(220)} style={styles.stageWrapper}>
              <View style={[styles.stage, { backgroundColor: Colors.black }]}>
                <FlatList
                  ref={listRef}
                  data={media}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item, i) => `${item.uri}-${i}`}
                  onMomentumScrollEnd={(e) => {
                    const i = Math.round(e.nativeEvent.contentOffset.x / STAGE_WIDTH);
                    setActiveIndex(i);
                  }}
                  renderItem={({ item, index }) => (
                    <View style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}>
                      <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      {item.type === 'video' && (
                        <View style={styles.videoBadge}>
                          <Ionicons name="videocam" size={12} color={Colors.white} />
                          <Text style={styles.videoBadgeText}>
                            {item.duration ? `${Math.round(item.duration / 1000)}s` : 'Video'}
                          </Text>
                        </View>
                      )}
                      <Pressable style={styles.removeChip} onPress={() => removeMedia(index)}>
                        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
                        <Ionicons name="trash-outline" size={15} color={Colors.white} />
                      </Pressable>
                    </View>
                  )}
                />
                {media.length > 1 && (
                  <View style={styles.dotsRow}>
                    {media.map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          i === activeIndex && { backgroundColor: Colors.white, width: 18 },
                        ]}
                      />
                    ))}
                  </View>
                )}
                {/* Multi-select counter badge */}
                {media.length > 1 && (
                  <View style={styles.countBadge}>
                    <Ionicons name="copy-outline" size={11} color={Colors.white} />
                    <Text style={styles.countBadgeText}>{media.length}</Text>
                  </View>
                )}
              </View>

              {/* Thumbnail strip */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbnailRow}
              >
                {media.map((item, i) => (
                  <Animated.View
                    key={item.uri + i}
                    entering={FadeIn.duration(180)}
                    exiting={FadeOut.duration(150)}
                    layout={LinearTransition.springify()}
                  >
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        setActiveIndex(i);
                        listRef.current?.scrollToIndex({ index: i, animated: true });
                      }}
                      style={[
                        styles.thumbnail,
                        i === activeIndex && styles.thumbnailActive,
                      ]}
                    >
                      <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      {item.type === 'video' && (
                        <View style={styles.thumbnailVideoIcon}>
                          <Ionicons name="videocam" size={9} color={Colors.white} />
                        </View>
                      )}
                    </Pressable>
                  </Animated.View>
                ))}
                {media.length < 10 && (
                  <Pressable
                    onPress={pickMedia}
                    style={[styles.thumbnailAdd, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  >
                    <Ionicons name="add" size={22} color={colors.textSecondary} />
                  </Pressable>
                )}
              </ScrollView>
            </Animated.View>
          )}

          {/* Caption */}
          <View style={styles.section}>
            <View style={[styles.captionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                value={caption}
                onChangeText={handleCaptionChange}
                placeholder="Write a caption… Use @ to mention and # for hashtags"
                placeholderTextColor={colors.textTertiary}
                style={[styles.captionInput, { color: colors.text }]}
                multiline
                maxLength={MAX_CAPTION}
                textAlignVertical="top"
              />
              <View style={styles.captionFoot}>
                <View style={styles.tokenChips}>
                  {tokens.hashtags.slice(0, 3).map((t) => (
                    <View key={`h-${t}`} style={styles.hashChip}>
                      <Text style={styles.hashChipText}>#{t}</Text>
                    </View>
                  ))}
                  {tokens.mentions.slice(0, 3).map((t) => (
                    <View key={`m-${t}`} style={styles.mentionChip}>
                      <Text style={styles.mentionChipText}>@{t}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[styles.counter, { color: colors.textTertiary }]}>
                  {caption.length}/{MAX_CAPTION}
                </Text>
              </View>
            </View>

            {/* Mention suggestions */}
            {mentionSuggestions.length > 0 && (
              <Animated.View
                entering={FadeInDown.duration(160)}
                style={[styles.mentionList, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                {mentionSuggestions.map((u) => (
                  <Pressable key={u._id} onPress={() => applyMention(u.username)} style={styles.mentionRow}>
                    <View style={styles.mentionAvatar}>
                      {u.profilePicture ? (
                        <Image source={{ uri: u.profilePicture }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      ) : (
                        <Text style={styles.mentionAvatarInitial}>{u.username[0].toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.mentionUsername, { color: colors.text }]}>{u.username}</Text>
                      {u.fullName ? (
                        <Text style={[styles.mentionFullname, { color: colors.textSecondary }]} numberOfLines={1}>
                          {u.fullName}
                        </Text>
                      ) : null}
                    </View>
                    {u.isVerified && <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />}
                  </Pressable>
                ))}
              </Animated.View>
            )}
          </View>

          {/* Details */}
          <View style={styles.section}>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setShowDetails((v) => !v); }}
              style={[styles.detailsToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Ionicons name="options-outline" size={18} color={colors.text} />
              <Text style={[styles.detailsToggleText, { color: colors.text }]}>Post settings</Text>
              <Ionicons
                name={showDetails ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textSecondary}
                style={{ marginLeft: 'auto' }}
              />
            </Pressable>

            {showDetails && (
              <Animated.View
                entering={FadeInDown.duration(200)}
                style={[styles.detailsBody, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                {/* Location */}
                <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
                  <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
                  <TextInput
                    value={location}
                    onChangeText={setLocation}
                    placeholder="Add location"
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.fieldInput, { color: colors.text }]}
                    maxLength={120}
                  />
                </View>

                {/* Visibility */}
                <View style={[styles.fieldGroup, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.fieldGroupLabel, { color: colors.textSecondary }]}>
                    Who can see this?
                  </Text>
                  <View style={styles.visibilityRow}>
                    {VISIBILITY_OPTIONS.map((opt) => {
                      const active = opt.value === visibility;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => { Haptics.selectionAsync(); setVisibility(opt.value); }}
                          style={[
                            styles.visibilityOption,
                            {
                              borderColor: active ? Colors.primary : colors.border,
                              backgroundColor: active ? 'rgba(108,92,231,0.1)' : 'transparent',
                            },
                          ]}
                        >
                          <Ionicons name={opt.icon} size={17} color={active ? Colors.primary : colors.textSecondary} />
                          <Text style={[styles.visibilityLabel, { color: active ? Colors.primary : colors.text }]}>
                            {opt.label}
                          </Text>
                          <Text style={[styles.visibilityHint, { color: colors.textTertiary }]} numberOfLines={1}>
                            {opt.hint}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Toggles */}
                <View style={[styles.toggleRow, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toggleLabel, { color: colors.text }]}>Allow comments</Text>
                    <Text style={[styles.toggleHint, { color: colors.textSecondary }]}>
                      Turn off to disable replies on this post
                    </Text>
                  </View>
                  <Switch
                    value={commentsEnabled}
                    onValueChange={setCommentsEnabled}
                    trackColor={{ true: Colors.primary, false: colors.border }}
                    thumbColor={Colors.white}
                  />
                </View>
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toggleLabel, { color: colors.text }]}>Show like count</Text>
                    <Text style={[styles.toggleHint, { color: colors.textSecondary }]}>
                      You'll always see likes on your own posts
                    </Text>
                  </View>
                  <Switch
                    value={likesVisible}
                    onValueChange={setLikesVisible}
                    trackColor={{ true: Colors.primary, false: colors.border }}
                    thumbColor={Colors.white}
                  />
                </View>
              </Animated.View>
            )}
          </View>

          {/* Share Button */}
          <View style={[styles.section, { paddingBottom: Spacing.md }]}>
            <Pressable
              onPress={handleShare}
              disabled={!canShare}
              style={[styles.shareBtn, !canShare && { opacity: 0.45 }]}
            >
              <LinearGradient
                colors={[...Colors.gradientPrimary]}
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
                  <Ionicons name="paper-plane-outline" size={19} color={Colors.white} />
                  <Text style={styles.shareBtnText}>Share Post</Text>
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
  headerTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.size.md,
  },
  headerAction: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  headerActionText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.base,
  },

  progressRail: {
    height: 2,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
  },

  scroll: {
    paddingHorizontal: Spacing.base,
  },

  emptyStage: {
    marginTop: Spacing.base,
    height: STAGE_HEIGHT,
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
  emptyTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.md,
    marginBottom: 6,
  },
  emptyHint: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.sm,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radii.full,
    overflow: 'hidden',
  },
  primaryBtnText: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.sm,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.sm,
  },

  stageWrapper: { marginTop: Spacing.base, gap: Spacing.md },
  stage: {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    borderRadius: Radii.xl,
    overflow: 'hidden',
  },
  videoBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radii.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  videoBadgeText: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.xs,
  },
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
  dotsRow: {
    position: 'absolute',
    bottom: Spacing.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  countBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  countBadgeText: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.xs,
  },
  thumbnailRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: Radii.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: Colors.primary,
  },
  thumbnailVideoIcon: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 4,
    padding: 2,
  },
  thumbnailAdd: {
    width: 60,
    height: 60,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },

  section: { marginTop: Spacing.xl },

  captionCard: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  captionInput: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.base,
    minHeight: 88,
    lineHeight: 22,
  },
  captionFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  tokenChips: { flexDirection: 'row', gap: 6, flex: 1, flexWrap: 'wrap' },
  hashChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.full, backgroundColor: 'rgba(108,92,231,0.12)' },
  hashChipText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.xs, color: Colors.primary },
  mentionChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.full, backgroundColor: 'rgba(9,132,227,0.12)' },
  mentionChipText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.xs, color: Colors.accent },
  counter: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },

  mentionList: {
    marginTop: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  mentionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(108,92,231,0.18)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentionAvatarInitial: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.sm,
    color: Colors.primary,
  },
  mentionUsername: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  mentionFullname: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },

  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
  },
  detailsToggleText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  detailsBody: {
    marginTop: Spacing.sm,
    borderRadius: Radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldInput: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.base,
    paddingVertical: 0,
  },
  fieldGroup: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldGroupLabel: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.xs },
  visibilityRow: { flexDirection: 'row', gap: Spacing.sm },
  visibilityOption: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  visibilityLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.xs, textAlign: 'center' },
  visibilityHint: { fontFamily: Typography.fontFamily.regular, fontSize: 10, textAlign: 'center' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  toggleLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  toggleHint: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, marginTop: 2 },

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
