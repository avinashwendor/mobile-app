import React, { useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, TextInput, ScrollView,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeIn, FadeInUp, SlideInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, Shadows } from '../../src/theme/tokens';
import GradientButton from '../../src/components/GradientButton';
import * as postApi from '../../src/api/post.api';
import * as storyApi from '../../src/api/story.api';
import * as reelApi from '../../src/api/reel.api';

type CreateMode = 'post' | 'story' | 'reel';

export default function CreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [mode, setMode] = useState<CreateMode>('post');
  const [selectedMedia, setSelectedMedia] = useState<{ uri: string; type: string }[]>([]);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const pickMedia = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mode === 'reel'
        ? ImagePicker.MediaTypeOptions.Videos
        : ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: mode === 'post',
      quality: 0.8,
      videoMaxDuration: mode === 'reel' ? 90 : 60,
    });

    if (!result.canceled && result.assets.length > 0) {
      setSelectedMedia(
        result.assets.map((a) => ({
          uri: a.uri,
          type: a.type === 'video' ? 'video/mp4' : 'image/jpeg',
        })),
      );
    }
  }, [mode]);

  const handlePublish = useCallback(async () => {
    if (selectedMedia.length === 0 && mode !== 'story') {
      Alert.alert('Media Required', 'Please select at least one photo or video.');
      return;
    }
    setIsUploading(true);

    try {
      if (mode === 'post') {
        await postApi.createPost({ caption, mediaFiles: selectedMedia });
        Alert.alert('Success', 'Post published!');
      } else if (mode === 'story') {
        await storyApi.createStory({
          mediaUri: selectedMedia[0]?.uri,
          mediaType: selectedMedia[0]?.type?.includes('video') ? 'video' : 'image',
          text: caption || undefined,
          visibility: 'public',
        });
        Alert.alert('Success', 'Story published!');
      } else if (mode === 'reel') {
        await reelApi.createReel({ videoUri: selectedMedia[0].uri, caption });
        Alert.alert('Success', 'Reel published!');
      }
      setSelectedMedia([]);
      setCaption('');
      router.back();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Upload failed. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setIsUploading(false);
    }
  }, [mode, selectedMedia, caption]);

  const modeConfig = {
    post: { icon: 'images-outline' as const, label: 'Post', color: Colors.primary },
    story: { icon: 'add-circle-outline' as const, label: 'Story', color: Colors.coral },
    reel: { icon: 'videocam-outline' as const, label: 'Reel', color: Colors.accent },
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.base, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Create</Text>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* Mode selector */}
        <View style={styles.modeSelector}>
          {(['post', 'story', 'reel'] as CreateMode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => { setMode(m); setSelectedMedia([]); }}
              style={[styles.modeTab, mode === m && { borderBottomColor: modeConfig[m].color, borderBottomWidth: 2 }]}
            >
              <Ionicons name={modeConfig[m].icon} size={22} color={mode === m ? modeConfig[m].color : colors.textTertiary} />
              <Text style={[styles.modeLabel, { color: mode === m ? colors.text : colors.textTertiary }]}>
                {modeConfig[m].label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Media selector */}
        <Pressable onPress={pickMedia} style={[styles.mediaPicker, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
          {selectedMedia.length > 0 ? (
            <Image source={{ uri: selectedMedia[0].uri }} style={styles.preview} contentFit="cover" />
          ) : (
            <View style={styles.mediaPlaceholder}>
              <View style={[styles.addMediaIcon, { backgroundColor: colors.surface }]}>
                <Ionicons name="camera-outline" size={36} color={Colors.primary} />
              </View>
              <Text style={[styles.addMediaText, { color: colors.textSecondary }]}>
                Tap to select {mode === 'reel' ? 'video' : 'media'}
              </Text>
              <Text style={[styles.addMediaHint, { color: colors.textTertiary }]}>
                {mode === 'post' ? 'Photos & videos' : mode === 'reel' ? 'Video up to 90s' : 'Photo or video'}
              </Text>
            </View>
          )}
        </Pressable>

        {selectedMedia.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailRow}>
            {selectedMedia.map((m, i) => (
              <Pressable key={i} style={styles.thumbnailItem} onPress={() => {
                setSelectedMedia((prev) => prev.filter((_, idx) => idx !== i));
              }}>
                <Image source={{ uri: m.uri }} style={styles.thumbnail} contentFit="cover" />
                <View style={styles.removeBadge}>
                  <Ionicons name="close-circle" size={18} color={Colors.error} />
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Caption */}
        <View style={[styles.captionBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Write a caption..."
            placeholderTextColor={colors.textTertiary}
            style={[styles.captionInput, { color: colors.text }]}
            multiline
            maxLength={2200}
          />
          <Text style={[styles.charCount, { color: colors.textTertiary }]}>{caption.length}/2200</Text>
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <Animated.View entering={SlideInDown} style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.sm, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <GradientButton
          title={isUploading ? 'Publishing...' : `Publish ${modeConfig[mode].label}`}
          onPress={handlePublish}
          loading={isUploading}
          disabled={selectedMedia.length === 0 && mode !== 'story'}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.base },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  title: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.xl },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modeSelector: { flexDirection: 'row', marginBottom: Spacing.xl, gap: Spacing.sm },
  modeTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  modeLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  mediaPicker: { borderRadius: Radii.xl, borderWidth: 1, borderStyle: 'dashed', overflow: 'hidden', marginBottom: Spacing.lg, aspectRatio: 1 },
  preview: { width: '100%', height: '100%' },
  mediaPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  addMediaIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  addMediaText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.base },
  addMediaHint: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm },
  thumbnailRow: { marginBottom: Spacing.lg },
  thumbnailItem: { width: 64, height: 64, borderRadius: Radii.sm, marginRight: Spacing.sm, overflow: 'hidden' },
  thumbnail: { width: '100%', height: '100%' },
  removeBadge: { position: 'absolute', top: -4, right: -4 },
  captionBox: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.lg },
  captionInput: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base, minHeight: 80, textAlignVertical: 'top' },
  charCount: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, textAlign: 'right', marginTop: Spacing.xs },
  bottomBar: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md, borderTopWidth: 0.5 },
});
