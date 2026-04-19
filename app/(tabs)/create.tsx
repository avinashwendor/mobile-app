import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  FlatList,
  Alert,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  Switch,
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
  FadeInUp,
  FadeOut,
  LinearTransition,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../../src/theme/ThemeProvider';
import {
  Colors,
  Typography,
  Spacing,
  Radii,
  Shadows,
  HitSlop,
} from '../../src/theme/tokens';
import * as postApi from '../../src/api/post.api';
import * as storyApi from '../../src/api/story.api';
import * as reelApi from '../../src/api/reel.api';
import * as userApi from '../../src/api/user.api';

/**
 * Create screen — single-surface composer for Post, Story and Reel uploads.
 *
 * Design choices:
 * - One screen, three modes. Switching preserves the caption but resets media
 *   because aspect-ratio / video-duration constraints differ.
 * - Media selection is a real carousel with reorder-by-remove and a
 *   prominent "add more" tile, keeping the primary interaction inside the
 *   hero preview instead of a separate gallery.
 * - Advanced options (location, visibility, toggles) are collapsed behind a
 *   single "Details" row so the default flow is two taps: pick media → share.
 * - Publishing is a committed state: the bottom bar swaps to a progress
 *   pill so the user never doubts whether the upload is in flight.
 */

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type CreateMode = 'post' | 'story' | 'reel';

type MediaAsset = {
  uri: string;
  type: 'image' | 'video';
  mimeType: string;
  width: number;
  height: number;
  duration?: number;
};

type Visibility = 'public' | 'followers' | 'private';

const MODE_META: Record<CreateMode, {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: readonly [string, string, ...string[]];
  hint: string;
  allowsMultiple: boolean;
  mediaTypes: ImagePicker.MediaTypeOptions;
  maxDuration?: number;
  aspectRatio: number;
}> = {
  post: {
    label: 'Post',
    icon: 'images',
    color: Colors.gradientPrimary,
    hint: 'Up to 10 photos or videos',
    allowsMultiple: true,
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    maxDuration: 60,
    aspectRatio: 1,
  },
  reel: {
    label: 'Reel',
    icon: 'film',
    color: Colors.gradientAccent,
    hint: 'Vertical video up to 90s',
    allowsMultiple: false,
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    maxDuration: 90,
    aspectRatio: 9 / 16,
  },
  story: {
    label: 'Story',
    icon: 'flash',
    color: Colors.gradientCoral,
    hint: 'Disappears in 24h',
    allowsMultiple: false,
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    maxDuration: 30,
    aspectRatio: 9 / 16,
  },
};

const VISIBILITY_META: { value: Visibility; label: string; icon: keyof typeof Ionicons.glyphMap; description: string }[] = [
  { value: 'public', label: 'Public', icon: 'globe-outline', description: 'Anyone on Instayt' },
  { value: 'followers', label: 'Followers', icon: 'people-outline', description: 'Only people who follow you' },
  { value: 'private', label: 'Only me', icon: 'lock-closed-outline', description: 'Saved privately' },
];

const MAX_CAPTION = 2200;

export default function CreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [mode, setMode] = useState<CreateMode>('post');
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [likesVisible, setLikesVisible] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mentionSuggestions, setMentionSuggestions] = useState<userApi.UserSearchResult[]>([]);

  const progress = useSharedValue(0);
  const previewListRef = useRef<FlatList<MediaAsset>>(null);
  const mentionLookupRef = useRef<number>(0);

  const meta = MODE_META[mode];

  const captionTokens = useMemo(() => extractTokens(caption), [caption]);
  const canPublish = media.length > 0 && !isUploading;

  const progressStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, progress.value)) * 100}%`,
  }));

  const handleModeChange = useCallback((next: CreateMode) => {
    if (next === mode) return;
    Haptics.selectionAsync();
    setMode(next);
    setMedia([]);
    setActiveMediaIndex(0);
  }, [mode]);

  const pickMedia = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'We need access to your photos to pick media for your post.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: meta.mediaTypes,
        allowsMultipleSelection: meta.allowsMultiple,
        selectionLimit: meta.allowsMultiple ? 10 : 1,
        quality: 0.85,
        videoMaxDuration: meta.maxDuration,
        exif: false,
      });

      if (result.canceled || result.assets.length === 0) return;

      const assets: MediaAsset[] = result.assets.map((a) => ({
        uri: a.uri,
        type: a.type === 'video' ? 'video' : 'image',
        mimeType: a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        width: a.width ?? 1080,
        height: a.height ?? 1080,
        duration: a.duration ?? undefined,
      }));

      if (mode === 'reel' && assets[0]?.type !== 'video') {
        Alert.alert('Videos only', 'Reels need to be videos. Please pick a video clip.');
        return;
      }

      setMedia(assets);
      setActiveMediaIndex(0);
    } catch (err: any) {
      Alert.alert('Could not open photos', err?.message ?? 'Please try again.');
    }
  }, [meta, mode]);

  const captureMedia = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Camera unavailable', 'Enable camera access in your device settings to capture media.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: meta.mediaTypes,
        quality: 0.85,
        videoMaxDuration: meta.maxDuration,
      });

      if (result.canceled || result.assets.length === 0) return;

      const a = result.assets[0];
      const asset: MediaAsset = {
        uri: a.uri,
        type: a.type === 'video' ? 'video' : 'image',
        mimeType: a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        width: a.width ?? 1080,
        height: a.height ?? 1080,
        duration: a.duration ?? undefined,
      };

      setMedia((prev) => (meta.allowsMultiple ? [...prev, asset].slice(0, 10) : [asset]));
      setActiveMediaIndex(meta.allowsMultiple ? media.length : 0);
    } catch (err: any) {
      Alert.alert('Could not open camera', err?.message ?? 'Please try again.');
    }
  }, [meta, media.length]);

  const removeMedia = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMedia((prev) => prev.filter((_, i) => i !== index));
    setActiveMediaIndex((prev) => Math.max(0, Math.min(prev, media.length - 2)));
  }, [media.length]);

  const handleCaptionChange = useCallback((value: string) => {
    setCaption(value);

    // Lightweight mention autocomplete — look at the last token only.
    const lastToken = value.split(/\s/).pop() ?? '';
    if (lastToken.startsWith('@') && lastToken.length > 1) {
      const query = lastToken.slice(1);
      const lookupId = ++mentionLookupRef.current;
      userApi
        .searchUsers(query, 1, 5)
        .then((res) => {
          if (lookupId !== mentionLookupRef.current) return;
          setMentionSuggestions(res.users);
        })
        .catch(() => {
          if (lookupId === mentionLookupRef.current) setMentionSuggestions([]);
        });
    } else if (mentionSuggestions.length) {
      setMentionSuggestions([]);
    }
  }, [mentionSuggestions.length]);

  const applyMention = useCallback((username: string) => {
    Haptics.selectionAsync();
    setCaption((prev) => {
      const tokens = prev.split(/\s/);
      tokens[tokens.length - 1] = `@${username} `;
      return tokens.join(' ');
    });
    setMentionSuggestions([]);
  }, []);

  const handlePublish = useCallback(async () => {
    if (!canPublish) return;

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsUploading(true);
      setUploadProgress(0);
      progress.value = withTiming(0.15, { duration: 300 });

      // Simulated staged progress — the HTTP client does not expose upload
      // progress, so we animate to a ceiling while the request is in flight.
      const interval = setInterval(() => {
        progress.value = withTiming(Math.min(0.9, progress.value + 0.07), { duration: 400 });
      }, 500);

      try {
        if (mode === 'post') {
          await postApi.createPost({
            caption: buildCaption(caption, captionTokens),
            mediaFiles: media.map((m) => ({ uri: m.uri, type: m.mimeType })),
            location: location.trim() || undefined,
            visibility,
            commentsEnabled,
            likesVisible,
          });
        } else if (mode === 'reel') {
          await reelApi.createReel({
            videoUri: media[0].uri,
            caption: buildCaption(caption, captionTokens),
            hashtags: captionTokens.hashtags,
          });
        } else {
          await storyApi.createStory({
            mediaUri: media[0].uri,
            mediaType: media[0].type,
            text: caption.trim() || undefined,
            visibility: visibility === 'private' ? 'close-friends' : visibility,
          });
        }

        progress.value = withTiming(1, { duration: 250 });
        setTimeout(() => {
          resetState();
          router.replace('/');
        }, 250);
      } finally {
        clearInterval(interval);
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = err?.message ?? 'Upload failed. Please try again.';
      Alert.alert('Could not publish', message);
      progress.value = withTiming(0, { duration: 200 });
    } finally {
      setIsUploading(false);
    }
  }, [canPublish, caption, captionTokens, commentsEnabled, likesVisible, location, media, mode, visibility, router]);

  const resetState = useCallback(() => {
    setMedia([]);
    setCaption('');
    setLocation('');
    setShowDetails(false);
    setActiveMediaIndex(0);
    setMentionSuggestions([]);
    progress.value = 0;
  }, []);

  const handleDiscard = useCallback(() => {
    if (!media.length && !caption.trim()) {
      router.back();
      return;
    }
    Alert.alert('Discard draft?', 'Your media and caption will not be saved.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          resetState();
          router.back();
        },
      },
    ]);
  }, [caption, media.length, resetState, router]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Header
        insetsTop={insets.top}
        canPublish={canPublish}
        isUploading={isUploading}
        onClose={handleDiscard}
        onPublish={handlePublish}
        actionLabel={isUploading ? 'Publishing' : `Share ${meta.label}`}
        colors={colors}
      />

      <ModeSwitcher mode={mode} onChange={handleModeChange} colors={colors} isDark={isDark} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 120 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <MediaStage
            media={media}
            activeIndex={activeMediaIndex}
            mode={mode}
            meta={meta}
            onPickMedia={pickMedia}
            onCaptureMedia={captureMedia}
            onRemoveMedia={removeMedia}
            onScrollToIndex={setActiveMediaIndex}
            listRef={previewListRef}
            colors={colors}
            isDark={isDark}
          />

          <CaptionBlock
            caption={caption}
            onChange={handleCaptionChange}
            mentions={mentionSuggestions}
            onApplyMention={applyMention}
            tokens={captionTokens}
            colors={colors}
          />

          <DetailsBlock
            mode={mode}
            location={location}
            onLocationChange={setLocation}
            visibility={visibility}
            onVisibilityChange={setVisibility}
            commentsEnabled={commentsEnabled}
            onCommentsChange={setCommentsEnabled}
            likesVisible={likesVisible}
            onLikesVisibleChange={setLikesVisible}
            expanded={showDetails}
            onToggle={() => {
              Haptics.selectionAsync();
              setShowDetails((v) => !v);
            }}
            colors={colors}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Publishing progress rail */}
      {isUploading ? (
        <View pointerEvents="none" style={[styles.progressRail, { bottom: insets.bottom + 88 }]}>
          <Animated.View style={[styles.progressFill, progressStyle]}>
            <LinearGradient
              colors={[...meta.color]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      ) : null}

      <BottomBar
        insetsBottom={insets.bottom}
        canPublish={canPublish}
        isUploading={isUploading}
        mode={mode}
        meta={meta}
        onPublish={handlePublish}
        colors={colors}
        isDark={isDark}
      />
    </View>
  );
}

/* -------------------- sub-components -------------------- */

function Header({
  insetsTop,
  canPublish,
  isUploading,
  onClose,
  onPublish,
  actionLabel,
  colors,
}: {
  insetsTop: number;
  canPublish: boolean;
  isUploading: boolean;
  onClose: () => void;
  onPublish: () => void;
  actionLabel: string;
  colors: any;
}) {
  return (
    <View style={[styles.header, { paddingTop: insetsTop + Spacing.sm, borderBottomColor: colors.border }]}>
      <Pressable onPress={onClose} hitSlop={HitSlop.md} style={styles.headerButton}>
        <Ionicons name="close" size={26} color={colors.text} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.text }]}>New</Text>
      <Pressable
        onPress={onPublish}
        disabled={!canPublish}
        hitSlop={HitSlop.md}
        style={[styles.headerAction, !canPublish && { opacity: 0.4 }]}
      >
        <Text style={[styles.headerActionText, { color: canPublish ? Colors.primary : colors.textTertiary }]}>
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}

function ModeSwitcher({
  mode,
  onChange,
  colors,
  isDark,
}: {
  mode: CreateMode;
  onChange: (m: CreateMode) => void;
  colors: any;
  isDark: boolean;
}) {
  const modes: CreateMode[] = ['post', 'reel', 'story'];
  return (
    <View style={[styles.modeSwitcher, { backgroundColor: isDark ? colors.surface : colors.surfaceHover }]}>
      {modes.map((m) => {
        const active = m === mode;
        const meta = MODE_META[m];
        return (
          <Pressable key={m} onPress={() => onChange(m)} style={styles.modeTab}>
            {active ? (
              <LinearGradient
                colors={[...meta.color]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <Ionicons
              name={meta.icon}
              size={18}
              color={active ? Colors.white : colors.textSecondary}
            />
            <Text
              style={[
                styles.modeTabLabel,
                { color: active ? Colors.white : colors.textSecondary },
              ]}
            >
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MediaStage({
  media,
  activeIndex,
  mode,
  meta,
  onPickMedia,
  onCaptureMedia,
  onRemoveMedia,
  onScrollToIndex,
  listRef,
  colors,
  isDark,
}: {
  media: MediaAsset[];
  activeIndex: number;
  mode: CreateMode;
  meta: typeof MODE_META[CreateMode];
  onPickMedia: () => void;
  onCaptureMedia: () => void;
  onRemoveMedia: (index: number) => void;
  onScrollToIndex: (index: number) => void;
  listRef: React.RefObject<FlatList<MediaAsset> | null>;
  colors: any;
  isDark: boolean;
}) {
  const stageWidth = SCREEN_WIDTH - Spacing.base * 2;
  const stageHeight = stageWidth / meta.aspectRatio;

  if (media.length === 0) {
    return (
      <Animated.View
        entering={FadeInUp.duration(280)}
        style={[
          styles.emptyStage,
          {
            height: stageHeight,
            borderColor: colors.border,
            backgroundColor: isDark ? colors.surface : colors.surfaceHover,
          },
        ]}
      >
        <LinearGradient
          colors={[
            isDark ? 'rgba(108,92,231,0.16)' : 'rgba(108,92,231,0.08)',
            'transparent',
          ]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(108,92,231,0.1)' }]}>
          <Ionicons name={meta.icon} size={36} color={Colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          Start a new {meta.label.toLowerCase()}
        </Text>
        <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>{meta.hint}</Text>

        <View style={styles.emptyActions}>
          <Pressable onPress={onPickMedia} style={styles.emptyPrimary}>
            <LinearGradient
              colors={[...meta.color]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="images-outline" size={18} color={Colors.white} />
            <Text style={styles.emptyPrimaryText}>Choose from library</Text>
          </Pressable>
          <Pressable
            onPress={onCaptureMedia}
            style={[styles.emptySecondary, { borderColor: colors.border }]}
          >
            <Ionicons name="camera-outline" size={18} color={colors.text} />
            <Text style={[styles.emptySecondaryText, { color: colors.text }]}>Camera</Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.stageWrapper}>
      <View style={[styles.stage, { height: stageHeight, backgroundColor: colors.surface }]}>
        <FlatList
          ref={listRef}
          data={media}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, i) => `${item.uri}-${i}`}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / stageWidth);
            onScrollToIndex(i);
          }}
          renderItem={({ item, index }) => (
            <View style={{ width: stageWidth, height: stageHeight }}>
              <Image source={{ uri: item.uri }} style={styles.stageMedia} contentFit="cover" />
              {item.type === 'video' ? (
                <View style={styles.videoBadge}>
                  <Ionicons name="videocam" size={12} color={Colors.white} />
                  <Text style={styles.videoBadgeText}>
                    {item.duration ? `${Math.round(item.duration / 1000)}s` : 'Video'}
                  </Text>
                </View>
              ) : null}
              <Pressable style={styles.removeChip} onPress={() => onRemoveMedia(index)}>
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                <Ionicons name="trash-outline" size={16} color={Colors.white} />
              </Pressable>
            </View>
          )}
        />

        {media.length > 1 ? (
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
        ) : null}
      </View>

      {meta.allowsMultiple ? (
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
                  onScrollToIndex(i);
                  listRef.current?.scrollToIndex({ index: i, animated: true });
                }}
                style={[
                  styles.thumbnail,
                  i === activeIndex && { borderColor: Colors.primary, borderWidth: 2 },
                ]}
              >
                <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              </Pressable>
            </Animated.View>
          ))}
          {media.length < 10 ? (
            <Pressable
              onPress={onPickMedia}
              style={[styles.thumbnailAdd, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Ionicons name="add" size={22} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </ScrollView>
      ) : (
        <Pressable onPress={onPickMedia} style={[styles.replaceRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="refresh-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.replaceText, { color: colors.textSecondary }]}>Replace media</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

function CaptionBlock({
  caption,
  onChange,
  mentions,
  onApplyMention,
  tokens,
  colors,
}: {
  caption: string;
  onChange: (v: string) => void;
  mentions: userApi.UserSearchResult[];
  onApplyMention: (username: string) => void;
  tokens: ReturnType<typeof extractTokens>;
  colors: any;
}) {
  return (
    <View style={styles.section}>
      <View style={[styles.captionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={caption}
          onChangeText={onChange}
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
              <View key={`h-${t}`} style={[styles.chip, { backgroundColor: 'rgba(108,92,231,0.12)' }]}>
                <Text style={[styles.chipText, { color: Colors.primary }]}>#{t}</Text>
              </View>
            ))}
            {tokens.mentions.slice(0, 3).map((t) => (
              <View key={`m-${t}`} style={[styles.chip, { backgroundColor: 'rgba(9,132,227,0.12)' }]}>
                <Text style={[styles.chipText, { color: Colors.accent }]}>@{t}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.counter, { color: colors.textTertiary }]}>
            {caption.length}/{MAX_CAPTION}
          </Text>
        </View>
      </View>

      {mentions.length > 0 ? (
        <Animated.View entering={FadeInDown.duration(160)} style={[styles.mentionList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {mentions.map((u) => (
            <Pressable
              key={u._id}
              onPress={() => onApplyMention(u.username)}
              style={styles.mentionRow}
            >
              <View style={styles.mentionAvatarFallback}>
                {u.profilePicture ? (
                  <Image source={{ uri: u.profilePicture }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <Text style={styles.mentionAvatarInitial}>{u.username.slice(0, 1).toUpperCase()}</Text>
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
              {u.isVerified ? (
                <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />
              ) : null}
            </Pressable>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

function DetailsBlock({
  mode,
  location,
  onLocationChange,
  visibility,
  onVisibilityChange,
  commentsEnabled,
  onCommentsChange,
  likesVisible,
  onLikesVisibleChange,
  expanded,
  onToggle,
  colors,
}: {
  mode: CreateMode;
  location: string;
  onLocationChange: (v: string) => void;
  visibility: Visibility;
  onVisibilityChange: (v: Visibility) => void;
  commentsEnabled: boolean;
  onCommentsChange: (v: boolean) => void;
  likesVisible: boolean;
  onLikesVisibleChange: (v: boolean) => void;
  expanded: boolean;
  onToggle: () => void;
  colors: any;
}) {
  const showLocation = mode !== 'reel'; // reels don't expose a location field on the backend
  const showAdvanced = mode === 'post';

  return (
    <View style={styles.section}>
      <Pressable
        onPress={onToggle}
        style={[styles.detailsHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Ionicons name="options-outline" size={18} color={colors.text} />
        <Text style={[styles.detailsHeaderText, { color: colors.text }]}>Details</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textSecondary}
          style={{ marginLeft: 'auto' }}
        />
      </Pressable>

      {expanded ? (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={[styles.detailsBody, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {showLocation ? (
            <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
              <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
              <TextInput
                value={location}
                onChangeText={onLocationChange}
                placeholder="Add location"
                placeholderTextColor={colors.textTertiary}
                style={[styles.fieldInput, { color: colors.text }]}
                maxLength={120}
              />
            </View>
          ) : null}

          <View style={[styles.fieldGroup, { borderBottomColor: colors.border }]}>
            <Text style={[styles.fieldGroupLabel, { color: colors.textSecondary }]}>Who can see this?</Text>
            <View style={styles.visibilityRow}>
              {VISIBILITY_META.map((v) => {
                const active = v.value === visibility;
                return (
                  <Pressable
                    key={v.value}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onVisibilityChange(v.value);
                    }}
                    style={[
                      styles.visibilityOption,
                      {
                        borderColor: active ? Colors.primary : colors.border,
                        backgroundColor: active ? 'rgba(108,92,231,0.1)' : 'transparent',
                      },
                    ]}
                  >
                    <Ionicons
                      name={v.icon}
                      size={18}
                      color={active ? Colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.visibilityLabel,
                        { color: active ? Colors.primary : colors.text },
                      ]}
                    >
                      {v.label}
                    </Text>
                    <Text style={[styles.visibilityHint, { color: colors.textTertiary }]} numberOfLines={1}>
                      {v.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {showAdvanced ? (
            <>
              <View style={[styles.toggleRow, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Allow comments</Text>
                  <Text style={[styles.toggleHint, { color: colors.textSecondary }]}>
                    Turn off to disable replies on this post
                  </Text>
                </View>
                <Switch
                  value={commentsEnabled}
                  onValueChange={onCommentsChange}
                  trackColor={{ true: Colors.primary, false: colors.border }}
                  thumbColor={Colors.white}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Show like count</Text>
                  <Text style={[styles.toggleHint, { color: colors.textSecondary }]}>
                    You'll always be able to see likes on your own posts
                  </Text>
                </View>
                <Switch
                  value={likesVisible}
                  onValueChange={onLikesVisibleChange}
                  trackColor={{ true: Colors.primary, false: colors.border }}
                  thumbColor={Colors.white}
                />
              </View>
            </>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

function BottomBar({
  insetsBottom,
  canPublish,
  isUploading,
  mode,
  meta,
  onPublish,
  colors,
  isDark,
}: {
  insetsBottom: number;
  canPublish: boolean;
  isUploading: boolean;
  mode: CreateMode;
  meta: typeof MODE_META[CreateMode];
  onPublish: () => void;
  colors: any;
  isDark: boolean;
}) {
  return (
    <Animated.View
      entering={SlideInDown.duration(240)}
      style={[
        styles.bottomBar,
        {
          paddingBottom: insetsBottom + Spacing.sm,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      ]}
    >
      <Pressable
        onPress={onPublish}
        disabled={!canPublish}
        style={[styles.publishButton, !canPublish && { opacity: 0.5 }]}
      >
        <LinearGradient
          colors={[...meta.color]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        {isUploading ? (
          <>
            <Ionicons name="cloud-upload-outline" size={18} color={Colors.white} />
            <Text style={styles.publishLabel}>Publishing…</Text>
          </>
        ) : (
          <>
            <Ionicons name="paper-plane-outline" size={18} color={Colors.white} />
            <Text style={styles.publishLabel}>Share {meta.label}</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

/* -------------------- helpers -------------------- */

function extractTokens(text: string): { hashtags: string[]; mentions: string[] } {
  const hashtags = Array.from(new Set(Array.from(text.matchAll(/#([\p{L}0-9_]+)/gu)).map((m) => m[1])));
  const mentions = Array.from(new Set(Array.from(text.matchAll(/@([a-zA-Z0-9_.]+)/g)).map((m) => m[1])));
  return { hashtags, mentions };
}

function buildCaption(text: string, tokens: { hashtags: string[]; mentions: string[] }): string {
  // No special rewriting today — surfaces a seam for future AI-powered
  // caption assistance without bloating the component body.
  return text.trim();
}

/* -------------------- styles -------------------- */

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
  headerButton: { padding: Spacing.xs },
  headerAction: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  headerActionText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.base,
  },
  headerTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.size.md,
  },

  modeSwitcher: {
    flexDirection: 'row',
    margin: Spacing.base,
    borderRadius: Radii.full,
    padding: Spacing.xxs,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
    gap: Spacing.xs,
    overflow: 'hidden',
  },
  modeTabLabel: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.sm,
  },

  scrollContent: {
    paddingHorizontal: Spacing.base,
  },

  emptyStage: {
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    overflow: 'hidden',
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.md,
  },
  emptyHint: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.sm,
    marginTop: 4,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  emptyActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  emptyPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radii.full,
    overflow: 'hidden',
  },
  emptyPrimaryText: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.sm,
  },
  emptySecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  emptySecondaryText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.sm,
  },

  stageWrapper: {
    gap: Spacing.md,
  },
  stage: {
    borderRadius: Radii.xl,
    overflow: 'hidden',
  },
  stageMedia: { width: '100%', height: '100%' },
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
    backgroundColor: 'rgba(255,255,255,0.5)',
  },

  thumbnailRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingRight: Spacing.base,
  },
  thumbnail: {
    width: 58,
    height: 58,
    borderRadius: Radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  thumbnailAdd: {
    width: 58,
    height: 58,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
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
  replaceText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.xs,
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
    minHeight: 96,
  },
  captionFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  tokenChips: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  chipText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.xs,
  },
  counter: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.xs,
  },

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
  mentionAvatarFallback: {
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
  mentionUsername: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.sm,
  },
  mentionFullname: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.xs,
  },

  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
  },
  detailsHeaderText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.sm,
  },
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
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldGroupLabel: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.xs,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  visibilityOption: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
    gap: 4,
  },
  visibilityLabel: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.sm,
  },
  visibilityHint: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toggleLabel: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.sm,
  },
  toggleHint: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.xs,
    marginTop: 2,
  },

  progressRail: {
    position: 'absolute',
    left: Spacing.base,
    right: Spacing.base,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    ...Shadows.lg,
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radii.full,
    overflow: 'hidden',
  },
  publishLabel: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.base,
  },
});
