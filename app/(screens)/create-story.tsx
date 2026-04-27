import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Dimensions,
  Image as RNImage,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { CameraView as CameraViewType } from 'expo-camera';
import ViewShot from 'react-native-view-shot';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

import { Colors, HitSlop, Radii, Spacing, Typography } from '../../src/theme/tokens';
import * as storyApi from '../../src/api/story.api';
import * as audioApi from '../../src/api/audio.api';
import type { AudioTrack } from '../../src/api/audio.api';

const { width: SW, height: SH } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Phase = 'camera' | 'preview';
type EditTool = 'none' | 'draw' | 'text' | 'sticker';
type StoryVisibility = 'public' | 'followers' | 'close-friends';
type Point = { x: number; y: number };
type DrawStroke = { points: Point[]; color: string; size: number };
type TextOverlay = { id: string; text: string; color: string; bold: boolean };
type EmojiOverlay = { id: string; emoji: string; x: number; y: number };
// Normalized face bounds stored at capture time (values 0-1 relative to view size)
type NormalizedFace = { left: number; top: number; width: number; height: number };

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const DRAW_COLORS = [
  '#FFFFFF', '#000000', '#FF6B6B', '#FDCB6E', '#A8FF78',
  '#74B9FF', '#A29BFE', '#FD79A8',
];

const FILTERS = [
  { id: 'none' as const,   label: 'Normal',  colors: null as null,                     opacity: 0    },
  { id: 'warm' as const,   label: 'Warm',    colors: ['#FF8C42', '#FFB347'] as const,  opacity: 0.3  },
  { id: 'cool' as const,   label: 'Cool',    colors: ['#3B82F6', '#06B6D4'] as const,  opacity: 0.25 },
  { id: 'mono' as const,   label: 'Mono',    colors: ['#374151', '#9CA3AF'] as const,  opacity: 0.45 },
  { id: 'sunset' as const, label: 'Sunset',  colors: ['#FB7185', '#F97316'] as const,  opacity: 0.35 },
  { id: 'neon' as const,   label: 'Neon',    colors: ['#7C3AED', '#06B6D4'] as const,  opacity: 0.3  },
  { id: 'drama' as const,  label: 'Drama',   colors: ['#1E1B4B', '#312E81'] as const,  opacity: 0.5  },
  { id: 'golden' as const, label: 'Golden',  colors: ['#F6D365', '#FDA085'] as const,  opacity: 0.3  },
];
type FilterId = typeof FILTERS[number]['id'];

/**
 * AR effects. When a face is detected, face-relative positioning is used.
 * faceTop/faceLeft/faceSize are fractions relative to the face bounding box:
 *   faceTop:  0 = face top, 1 = face bottom, negative = above face
 *   faceLeft: 0 = face left, 1 = face right, 0.5 = center
 *   faceSize: fraction of face width for the emoji font size
 * Fallback (no face): topPct/leftPct/size are screen-relative.
 */
type AROverlay = {
  emoji: string;
  // Face-relative
  faceTop: number;   faceLeft: number;  faceSize: number;
  // Screen-relative fallback
  topPct: number;    leftPct: number;   size: number;
};
type AREffect = { id: string; label: string; icon: string; overlays: AROverlay[] };

const AR_EFFECTS: AREffect[] = [
  { id: 'none',       label: 'None',    icon: 'none', overlays: [] },
  { id: 'dog',        label: 'Dog',     icon: '🐶', overlays: [
    { emoji: '🐶', faceTop: -0.55, faceLeft: 0.5,  faceSize: 1.1,  topPct: 0.22, leftPct: 0.5,  size: 90 },
    { emoji: '🐾', faceTop: -0.45, faceLeft: 0.05, faceSize: 0.35, topPct: 0.13, leftPct: 0.18, size: 34 },
    { emoji: '🐾', faceTop: -0.45, faceLeft: 0.85, faceSize: 0.35, topPct: 0.13, leftPct: 0.72, size: 34 },
  ]},
  { id: 'crown',      label: 'Crown',   icon: '👑', overlays: [
    { emoji: '👑', faceTop: -0.7,  faceLeft: 0.5,  faceSize: 1.0,  topPct: 0.09, leftPct: 0.5,  size: 80 },
  ]},
  { id: 'sunglasses', label: 'Glasses', icon: '😎', overlays: [
    { emoji: '😎', faceTop: 0.2,   faceLeft: 0.5,  faceSize: 1.0,  topPct: 0.25, leftPct: 0.5,  size: 88 },
  ]},
  { id: 'hearts',     label: 'Hearts',  icon: '💕', overlays: [
    { emoji: '💕', faceTop: -0.55, faceLeft: 0.0,  faceSize: 0.35, topPct: 0.07, leftPct: 0.08, size: 30 },
    { emoji: '❤️',  faceTop: -0.55, faceLeft: 0.9,  faceSize: 0.3,  topPct: 0.11, leftPct: 0.74, size: 28 },
    { emoji: '💕', faceTop: 0.8,   faceLeft: 0.85, faceSize: 0.28, topPct: 0.26, leftPct: 0.84, size: 22 },
    { emoji: '❤️',  faceTop: 0.8,   faceLeft: 0.0,  faceSize: 0.3,  topPct: 0.70, leftPct: 0.06, size: 28 },
  ]},
  { id: 'fire',       label: 'Fire',    icon: '🔥', overlays: [
    { emoji: '🔥', faceTop: 1.05, faceLeft: -0.15, faceSize: 0.55, topPct: 0.74, leftPct: 0.12, size: 52 },
    { emoji: '🔥', faceTop: 1.1,  faceLeft: 0.4,  faceSize: 0.65, topPct: 0.72, leftPct: 0.44, size: 62 },
    { emoji: '🔥', faceTop: 1.05, faceLeft: 0.9,  faceSize: 0.55, topPct: 0.74, leftPct: 0.74, size: 52 },
  ]},
  { id: 'sparkle',    label: 'Sparkle', icon: '✨', overlays: [
    { emoji: '✨', faceTop: -0.6,  faceLeft: -0.3, faceSize: 0.3,  topPct: 0.08, leftPct: 0.08, size: 28 },
    { emoji: '⭐', faceTop: -0.5,  faceLeft: 1.1,  faceSize: 0.28, topPct: 0.14, leftPct: 0.80, size: 26 },
    { emoji: '✨', faceTop: 0.3,   faceLeft: -0.45,faceSize: 0.25, topPct: 0.30, leftPct: 0.04, size: 22 },
    { emoji: '⭐', faceTop: 0.3,   faceLeft: 1.2,  faceSize: 0.25, topPct: 0.32, leftPct: 0.86, size: 22 },
  ]},
  { id: 'rainbow',    label: 'Rainbow', icon: '🌈', overlays: [
    { emoji: '🌈', faceTop: -0.85, faceLeft: 0.5,  faceSize: 1.3,  topPct: 0.09, leftPct: 0.5,  size: 110 },
  ]},
];

const STICKER_ROWS = [
  ['😂', '🔥', '💕', '✨', '😍', '🥺', '💯', '🎉'],
  ['😊', '🌈', '⭐', '💜', '🎵', '🌸', '💎', '🦋'],
  ['🌙', '☀️', '🍕', '🎸', '🦄', '💫', '🌊', '🎪'],
  ['🤩', '😤', '🥳', '😜', '🤳', '💅', '🫶', '🙌'],
];

const TEXT_COLORS = ['#FFFFFF', '#000000', '#FF6B6B', '#FDCB6E', '#A8FF78', '#74B9FF', '#A29BFE', '#FD79A8'];

const VISIBILITY_OPTIONS: { value: StoryVisibility; label: string; desc: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'public',        label: 'Everyone',      desc: 'All users can see',          icon: 'globe-outline'   },
  { value: 'followers',     label: 'Followers',     desc: 'People who follow you',      icon: 'people-outline'  },
  { value: 'close-friends', label: 'Close Friends', desc: 'Your close friends list',    icon: 'heart-outline'   },
];

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function CreateStoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Phase
  const [phase, setPhase] = useState<Phase>('camera');

  // Camera state
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const cameraRef = useRef<CameraViewType>(null);
  const viewShotRef = useRef<any>(null);
  const [arEffectId, setArEffectId] = useState<string>('none');
  const [isCapturing, setIsCapturing] = useState(false);
  const [viewW, setViewW] = useState(SW);
  const [viewH, setViewH] = useState(SH);
  const [isPreviewImageLoaded, setIsPreviewImageLoaded] = useState(false);
  // No native face detection in Expo Go — AR overlays use screen-relative positioning
  const capturedFace: NormalizedFace | null = null;
  const captureScale = useSharedValue(1);
  const captureRingScale = useSharedValue(1);
  const captureScaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: captureScale.value }] }));
  const captureRingStyle = useAnimatedStyle(() => ({ transform: [{ scale: captureRingScale.value }] }));

  // Preview state
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [capturedType, setCapturedType] = useState<'photo' | 'video'>('photo');
  const [filterId, setFilterId] = useState<FilterId>('none');
  const [activeArEffect, setActiveArEffect] = useState<string>('none');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const uploadProgress = useSharedValue(0);
  const uploadBarStyle = useAnimatedStyle(() => ({
    width: `${uploadProgress.value * 100}%` as any,
  }));

  // Drawing
  const [editTool, setEditTool] = useState<EditTool>('none');
  const [drawColor, setDrawColor] = useState('#FFFFFF');
  const [drawSize, setDrawSize] = useState(6);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const currentStrokeRef = useRef<Point[]>([]);
  const lastPointRef = useRef<Point | null>(null);
  const [drawRenderKey, setDrawRenderKey] = useState(0);
  const editToolRef = useRef<EditTool>('none');
  const drawColorRef = useRef('#FFFFFF');
  const drawSizeRef = useRef(6);
  useEffect(() => { editToolRef.current = editTool; }, [editTool]);
  useEffect(() => { drawColorRef.current = drawColor; }, [drawColor]);
  useEffect(() => { drawSizeRef.current = drawSize; }, [drawSize]);

  // Text overlays
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [showTextModal, setShowTextModal] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [textBold, setTextBold] = useState(false);

  // Emoji stickers
  const [emojiStickers, setEmojiStickers] = useState<EmojiOverlay[]>([]);
  const [showStickerModal, setShowStickerModal] = useState(false);

  // Audio track
  const [selectedAudio, setSelectedAudio] = useState<AudioTrack | null>(null);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [audioSearch, setAudioSearch] = useState('');
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [audioLoading, setAudioLoading] = useState(false);

  // Visibility
  const [showVisibilitySheet, setShowVisibilitySheet] = useState(false);

  // PanResponder for drawing (uses refs to avoid stale closure)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => editToolRef.current === 'draw',
      onMoveShouldSetPanResponder: () => editToolRef.current === 'draw',
      onPanResponderGrant: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        currentStrokeRef.current = [{ x, y }];
        lastPointRef.current = { x, y };
        setDrawRenderKey((k) => k + 1);
      },
      onPanResponderMove: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        const last = lastPointRef.current;
        if (last) {
          const dx = x - last.x;
          const dy = y - last.y;
          if (dx * dx + dy * dy < 9) return;
        }
        lastPointRef.current = { x, y };
        currentStrokeRef.current = [...currentStrokeRef.current, { x, y }];
        setDrawRenderKey((k) => k + 1);
      },
      onPanResponderRelease: () => {
        const pts = currentStrokeRef.current;
        if (pts.length > 0) {
          setStrokes((prev) => [
            ...prev,
            { points: pts, color: drawColorRef.current, size: drawSizeRef.current },
          ]);
        }
        currentStrokeRef.current = [];
        lastPointRef.current = null;
        setDrawRenderKey((k) => k + 1);
      },
    }),
  ).current;

  // ─── Camera handlers ───────────────────────────────────────
  const takePicture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    captureScale.value = withSpring(0.85, {}, () => { captureScale.value = withSpring(1); });
    captureRingScale.value = withSpring(1.2, {}, () => { captureRingScale.value = withSpring(1); });
    try {
      const result = await cameraRef.current.takePictureAsync({ quality: 0.92 });
      if (result?.uri) {
        setCapturedUri(result.uri);
        setCapturedType('photo');
        setActiveArEffect(arEffectId);
        setPhase('preview');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {
      Alert.alert('Capture failed', 'Could not take photo. Try again.');
    } finally {
      setIsCapturing(false);
    }
  }, [arEffectId, captureRingScale, captureScale, isCapturing]);

  const pickFromGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.7,          // compress images at pick time
      videoQuality: 0,       // 0 = lowest quality = max compression (Expo Go compatible)
      videoMaxDuration: 60,  // enforce 60s limit at picker level
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.type === 'video' && (asset.duration ?? 0) > 60000) {
      Alert.alert('Video too long', 'Stories can be at most 60 seconds.');
      return;
    }
    setCapturedUri(asset.uri);
    setCapturedType(asset.type === 'video' ? 'video' : 'photo');
    setActiveArEffect('none');
    setPhase('preview');
    Haptics.selectionAsync();
  }, []);

  const pickVideo = useCallback(async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 60,
      videoQuality: 0, // max compression at record time
    });
    if (result.canceled || !result.assets?.[0]) return;
    setCapturedUri(result.assets[0].uri);
    setCapturedType('video');
    setActiveArEffect('none');
    setPhase('preview');
    Haptics.selectionAsync();
  }, []);

  // ─── Share ─────────────────────────────────────────────────
  const handleShare = useCallback(async (vis: StoryVisibility) => {
    if (!capturedUri || isUploading) return;
    setIsUploading(true);
    uploadProgress.value = 0;
    uploadProgress.value = withTiming(0.85, { duration: 2000 });
    try {
      // Composite all overlays (filters, AR, drawing, text, stickers) into a single image
      let finalUri = capturedUri;
      if (capturedType === 'photo' && viewShotRef.current) {
        try {
          // Wait for the base image to finish rendering inside ViewShot before capturing
          if (!isPreviewImageLoaded) {
            await new Promise<void>((resolve) => setTimeout(resolve, 500));
          }
          // Give the JS thread one extra frame to flush any pending layout/paint
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const shotPath = await viewShotRef.current.capture({ format: 'jpg', quality: 0.93, result: 'tmpfile' });
          // Ensure file:// prefix so React Native's XHR can read it reliably
          finalUri = shotPath.startsWith('file://') ? shotPath : `file://${shotPath}`;
        } catch (shotErr) {
          console.warn('[ViewShot] capture failed, uploading raw photo:', shotErr);
          // finalUri stays as capturedUri (raw photo fallback)
        }
      }
      await storyApi.createStory({
        mediaUri: finalUri,
        mediaType: capturedType === 'video' ? 'video' : 'image',
        text: caption.trim() || undefined,
        visibility: vis,
        filterId: filterId === 'none' ? undefined : filterId,
        audioTrackId: selectedAudio?._id,
      });
      uploadProgress.value = withTiming(1, { duration: 300 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert('Upload failed', 'Could not upload your story. Please try again.');
      uploadProgress.value = withTiming(0, { duration: 200 });
    } finally {
      setIsUploading(false);
    }
  }, [caption, capturedType, capturedUri, filterId, isPreviewImageLoaded, isUploading, router, selectedAudio, uploadProgress]);

  // ─── Audio picker ──────────────────────────────────────────
  const openAudioModal = useCallback(async () => {
    setShowAudioModal(true);
    if (audioTracks.length === 0) {
      setAudioLoading(true);
      try {
        const tracks = await audioApi.getTrendingAudio(30);
        setAudioTracks(tracks);
      } catch { /* silently ignore */ }
      finally { setAudioLoading(false); }
    }
  }, [audioTracks.length]);

  const handleAudioSearch = useCallback(async (q: string) => {
    setAudioSearch(q);
    if (!q.trim()) {
      setAudioLoading(true);
      try { setAudioTracks(await audioApi.getTrendingAudio(30)); } catch { /* */ }
      finally { setAudioLoading(false); }
      return;
    }
    setAudioLoading(true);
    try { setAudioTracks(await audioApi.searchAudio(q.trim())); } catch { /* */ }
    finally { setAudioLoading(false); }
  }, []);

  // ─── Text overlay ──────────────────────────────────────────
  const commitText = useCallback(() => {
    const t = textInput.trim();
    if (!t) { setShowTextModal(false); return; }
    setTextOverlays((prev) => [
      ...prev,
      { id: `t-${Date.now()}`, text: t, color: textColor, bold: textBold },
    ]);
    setTextInput('');
    setShowTextModal(false);
    Haptics.selectionAsync();
  }, [textBold, textColor, textInput]);

  // ─── Emoji sticker ─────────────────────────────────────────
  const addEmoji = useCallback((emoji: string) => {
    const x = SW * 0.25 + Math.random() * SW * 0.45;
    const y = SH * 0.25 + Math.random() * SH * 0.35;
    setEmojiStickers((prev) => [...prev, { id: `e-${Date.now()}`, emoji, x, y }]);
    setShowStickerModal(false);
    Haptics.selectionAsync();
  }, []);

  const undoLastStroke = useCallback(() => {
    setStrokes((prev) => prev.slice(0, -1));
    Haptics.selectionAsync();
  }, []);

  // ─── Derived ───────────────────────────────────────────────
  const activeFilter = FILTERS.find((f) => f.id === filterId)!;
  const activeAROverlays = AR_EFFECTS.find((e) => e.id === activeArEffect)?.overlays ?? [];
  const activeCameraEffect = AR_EFFECTS.find((e) => e.id === arEffectId);

  /**
   * Render AR effect overlays, face-aware when a face is detected/stored.
   */
  const renderAROverlays = useCallback((
    overlays: AROverlay[],
    face: NormalizedFace | null,
    vw: number,
    vh: number,
  ) => {
    if (overlays.length === 0) return null;
    return overlays.map((ov, i) => {
      let top: number;
      let left: number;
      let size: number;
      if (face) {
        const facePxW = face.width * vw;
        const facePxH = face.height * vh;
        const facePxL = face.left * vw;
        const facePxT = face.top * vh;
        size = Math.max(18, ov.faceSize * facePxW);
        // faceLeft=0.5 means centered horizontally over the face
        left = facePxL + ov.faceLeft * facePxW - size / 2;
        // faceTop=0 means face top, negative = above face
        top = facePxT + ov.faceTop * facePxH - size / 2;
      } else {
        size = ov.size;
        top = ov.topPct * vh - size / 2;
        left = ov.leftPct * vw - size / 2;
      }
      return (
        <Text
          key={i}
          style={[styles.arOverlayEmoji, { top, left, fontSize: size }]}
          pointerEvents="none"
        >
          {ov.emoji}
        </Text>
      );
    });
  }, []);

  // ─────────────────────────────────────────────────────────
  // Permission screen
  // ─────────────────────────────────────────────────────────
  if (!cameraPermission) return <View style={styles.screen} />;

  if (!cameraPermission.granted) {
    return (
      <View style={[styles.screen, styles.permScreen]}>
        <Ionicons name="camera-outline" size={64} color={Colors.white} style={{ marginBottom: Spacing.lg }} />
        <Text style={styles.permTitle}>Camera Access</Text>
        <Text style={styles.permDesc}>
          Allow camera access to take photos and videos for your story.
        </Text>
        <Pressable onPress={requestCameraPermission} style={styles.permBtn}>
          <LinearGradient colors={[...Colors.gradientPrimary]} style={styles.permBtnGradient}>
            <Text style={styles.permBtnText}>Allow Camera</Text>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={pickFromGallery} style={styles.permGallery}>
          <Text style={styles.permGalleryText}>Choose from Gallery</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.permGallery}>
          <Text style={[styles.permGalleryText, { opacity: 0.5 }]}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // CAMERA PHASE
  // ═══════════════════════════════════════════════════════════
  if (phase === 'camera') {
    return (
      <View
        style={styles.screen}
        onLayout={(e) => {
          setViewW(e.nativeEvent.layout.width);
          setViewH(e.nativeEvent.layout.height);
        }}
      >
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flash}
          mode="picture"
        />

        {/* AR overlays on live preview (screen-relative, no face tracking needed) */}
        {activeCameraEffect && activeCameraEffect.id !== 'none' &&
          renderAROverlays(activeCameraEffect.overlays, null, viewW, viewH)
        }

        {/* Top bar */}
        <View style={[styles.camTopBar, { paddingTop: insets.top + Spacing.xs }]}>
          <Pressable onPress={() => router.back()} hitSlop={HitSlop.lg} style={styles.camIconBtn}>
            <Ionicons name="close" size={26} color={Colors.white} />
          </Pressable>
          <View style={styles.camTopRight}>
            <Pressable
              onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
              hitSlop={HitSlop.md}
              style={styles.camIconBtn}
            >
              <Ionicons
                name={flash === 'on' ? 'flash' : 'flash-off'}
                size={22}
                color={flash === 'on' ? '#FDCB6E' : Colors.white}
              />
            </Pressable>
            <Pressable
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
              hitSlop={HitSlop.md}
              style={styles.camIconBtn}
            >
              <Ionicons name="camera-reverse-outline" size={24} color={Colors.white} />
            </Pressable>
          </View>
        </View>

        {/* AR effect selector */}
        <View style={styles.arStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.arStripContent}>
            {AR_EFFECTS.map((effect) => (
              <Pressable
                key={effect.id}
                onPress={() => { setArEffectId(effect.id); Haptics.selectionAsync(); }}
                style={[styles.arEffectBtn, arEffectId === effect.id && styles.arEffectBtnActive]}
              >
                {effect.id === 'none' ? (
                  <Ionicons name="close-circle-outline" size={24} color={arEffectId === 'none' ? Colors.white : 'rgba(255,255,255,0.6)'} />
                ) : (
                  <Text style={styles.arEffectIcon}>{effect.icon}</Text>
                )}
                <Text style={[styles.arEffectLabel, arEffectId === effect.id && { color: Colors.white }]}>
                  {effect.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Bottom controls */}
        <View style={[styles.camBottom, { paddingBottom: insets.bottom + Spacing.md }]}>
          <Pressable onPress={pickFromGallery} style={styles.camSideBtn} hitSlop={HitSlop.md}>
            <View style={styles.camSideBtnInner}>
              <Ionicons name="images-outline" size={26} color={Colors.white} />
            </View>
            <Text style={styles.camSideLabel}>Gallery</Text>
          </Pressable>

          {/* Capture button */}
          <View style={styles.captureWrapper}>
            <Animated.View style={[styles.captureRing, captureRingStyle]}>
              <Animated.View style={captureScaleStyle}>
                <Pressable onPress={takePicture} disabled={isCapturing} style={styles.captureInner} />
              </Animated.View>
            </Animated.View>
            <Text style={styles.captureHint}>TAP</Text>
          </View>

          <Pressable onPress={pickVideo} style={styles.camSideBtn} hitSlop={HitSlop.md}>
            <View style={styles.camSideBtnInner}>
              <Ionicons name="videocam-outline" size={26} color={Colors.white} />
            </View>
            <Text style={styles.camSideLabel}>Video</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // PREVIEW / EDIT PHASE
  // ═══════════════════════════════════════════════════════════
  return (
    <View
      style={styles.screen}
      onLayout={(e) => {
        setViewW(e.nativeEvent.layout.width);
        setViewH(e.nativeEvent.layout.height);
      }}
    >
      {/* ViewShot wraps media + all overlays so we can composite to a single image.
          Must have explicit w/h — absoluteFill alone gives zero dimensions on capture. */}
      <ViewShot
        ref={viewShotRef}
        style={[StyleSheet.absoluteFill, { width: viewW || SW, height: viewH || SH }]}
        options={{ format: 'jpg', quality: 0.93, result: 'tmpfile' }}
      >
        {/* Media */}
        {capturedType === 'video' ? (
          <Video
            source={{ uri: capturedUri! }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping
            isMuted={false}
          />
        ) : (
          // Use RN's built-in Image here — expo-image renders on a separate native layer
          // that react-native-view-shot cannot snapshot, so effects wouldn't be composited.
          <RNImage
            source={{ uri: capturedUri! }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onLoad={() => setIsPreviewImageLoaded(true)}
          />
        )}

        {/* Color filter overlay */}
        {activeFilter.colors && (
          <View
            style={[StyleSheet.absoluteFill, { opacity: activeFilter.opacity }]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={activeFilter.colors as any}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </View>
        )}

        {/* Face-aware AR overlays on preview (uses stored face from capture time) */}
        {renderAROverlays(activeAROverlays, capturedFace, viewW, viewH)}

        {/* Drawing canvas — inside ViewShot so strokes are composited in the saved image */}
        <View
          style={StyleSheet.absoluteFill}
          {...panResponder.panHandlers}
          pointerEvents={editTool === 'draw' ? 'box-only' : 'none'}
        >
          {strokes.map((stroke, si) =>
            stroke.points.map((pt, pi) => (
              <View key={`${si}-${pi}`} style={[styles.drawDot, {
                left: pt.x - stroke.size / 2,
                top: pt.y - stroke.size / 2,
                width: stroke.size,
                height: stroke.size,
                borderRadius: stroke.size / 2,
                backgroundColor: stroke.color,
              }]} />
            )),
          )}
          {currentStrokeRef.current.map((pt, pi) => (
            <View key={`cur-${pi}-${drawRenderKey}`} style={[styles.drawDot, {
              left: pt.x - drawSizeRef.current / 2,
              top: pt.y - drawSizeRef.current / 2,
              width: drawSizeRef.current,
              height: drawSizeRef.current,
              borderRadius: drawSizeRef.current / 2,
              backgroundColor: drawColorRef.current,
            }]} />
          ))}
        </View>

        {/* Text overlays — inside ViewShot */}
        {textOverlays.map((t) => (
          <View key={t.id} style={styles.textOverlayWrapper} pointerEvents="none">
            <Text style={[styles.textOverlayText, {
              color: t.color,
              fontWeight: t.bold ? '700' : '400',
              textShadowColor: 'rgba(0,0,0,0.75)',
              textShadowOffset: { width: 1, height: 1 },
              textShadowRadius: 4,
            }]}>
              {t.text}
            </Text>
          </View>
        ))}

        {/* Emoji stickers — inside ViewShot */}
        {emojiStickers.map((s) => (
          <Text key={s.id} style={[styles.emojiStickerOnCanvas, { left: s.x, top: s.y }]} pointerEvents="none">
            {s.emoji}
          </Text>
        ))}
      </ViewShot>

      {/* TOP BAR */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'transparent']}
        style={[styles.previewTopBar, { paddingTop: insets.top + Spacing.xs }]}
        pointerEvents="box-none"
      >
        <View style={styles.previewTopLeft}>
          <Pressable
            onPress={() => {
              setPhase('camera');
              setCapturedUri(null);
              setStrokes([]);
              setTextOverlays([]);
              setEmojiStickers([]);
              setFilterId('none');
              setEditTool('none');
              setIsPreviewImageLoaded(false);
            }}
            hitSlop={HitSlop.lg}
            style={styles.previewTopBtn}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </Pressable>
          {strokes.length > 0 && (
            <Pressable onPress={undoLastStroke} hitSlop={HitSlop.md} style={styles.previewTopBtn}>
              <Ionicons name="arrow-undo" size={20} color={Colors.white} />
            </Pressable>
          )}
        </View>

        <View style={styles.previewToolbar}>
          <Pressable
            onPress={() => { setEditTool('text'); setShowTextModal(true); }}
            style={[styles.toolBtn, editTool === 'text' && styles.toolBtnActive]}
            hitSlop={HitSlop.sm}
          >
            <Text style={styles.toolBtnText}>Aa</Text>
          </Pressable>
          <Pressable
            onPress={() => { setEditTool(editTool === 'draw' ? 'none' : 'draw'); Haptics.selectionAsync(); }}
            style={[styles.toolBtn, editTool === 'draw' && styles.toolBtnActive]}
            hitSlop={HitSlop.sm}
          >
            <Ionicons name="pencil" size={18} color={editTool === 'draw' ? Colors.primary : Colors.white} />
          </Pressable>
          <Pressable
            onPress={() => { setEditTool('sticker'); setShowStickerModal(true); }}
            style={[styles.toolBtn, editTool === 'sticker' && styles.toolBtnActive]}
            hitSlop={HitSlop.sm}
          >
            <Text style={styles.toolIconEmoji}>😊</Text>
          </Pressable>
          <Pressable
            onPress={openAudioModal}
            style={[styles.toolBtn, selectedAudio != null && styles.toolBtnActive]}
            hitSlop={HitSlop.sm}
          >
            <Ionicons name="musical-notes-outline" size={18} color={selectedAudio ? Colors.primary : Colors.white} />
          </Pressable>
        </View>
      </LinearGradient>

      {/* Selected audio badge */}
      {selectedAudio && (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.audioBadge, { top: insets.top + 68 }]} pointerEvents="none">
          <Ionicons name="musical-note" size={12} color={Colors.white} />
          <Text style={styles.audioBadgeText} numberOfLines={1}>{selectedAudio.title} · {selectedAudio.artist}</Text>
        </Animated.View>
      )}

      {/* Draw color palette */}
      {editTool === 'draw' && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[styles.drawPalette, { top: insets.top + 68 }]}
          pointerEvents="box-none"
        >
          {DRAW_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setDrawColor(c)}
              style={[styles.drawColorBtn, { backgroundColor: c }, drawColor === c && styles.drawColorBtnSelected]}
            />
          ))}
          <View style={styles.drawSizeRow}>
            {[4, 8, 14].map((sz) => (
              <Pressable
                key={sz}
                onPress={() => setDrawSize(sz)}
                style={[styles.drawSizeBtn, drawSize === sz && styles.drawSizeBtnSelected]}
              >
                <View style={{
                  width: sz + 4, height: sz + 4, borderRadius: (sz + 4) / 2,
                  backgroundColor: drawColor,
                }} />
              </Pressable>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Filter strip */}
      {editTool !== 'draw' && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.filterStrip} pointerEvents="box-none">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterStripContent}>
            {FILTERS.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => { setFilterId(f.id); Haptics.selectionAsync(); }}
                style={styles.filterBtn}
              >
                <View style={[styles.filterThumb, filterId === f.id && styles.filterThumbActive]}>
                  {f.colors ? (
                    <LinearGradient colors={f.colors as any} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#666' }]} />
                  )}
                  {filterId === f.id && (
                    <View style={styles.filterCheck}>
                      <Ionicons name="checkmark" size={10} color={Colors.white} />
                    </View>
                  )}
                </View>
                <Text style={[styles.filterLabel, filterId === f.id && { color: Colors.white }]}>{f.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* BOTTOM SHARE BAR */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={[styles.previewBottom, { paddingBottom: insets.bottom + Spacing.md }]}
        pointerEvents="box-none"
      >
        <View style={styles.captionRow}>
          <TextInput
            style={styles.captionInput}
            placeholder="Add a caption..."
            placeholderTextColor="rgba(255,255,255,0.45)"
            value={caption}
            onChangeText={setCaption}
            maxLength={150}
            returnKeyType="done"
          />
        </View>

        {isUploading && (
          <View style={styles.uploadTrack}>
            <Animated.View style={[styles.uploadFill, uploadBarStyle]} />
          </View>
        )}

        <View style={styles.shareRow}>
          <Pressable onPress={() => handleShare('public')} disabled={isUploading} style={styles.shareBtn}>
            <LinearGradient
              colors={[...Colors.gradientStory] as any}
              style={styles.shareBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="person-circle-outline" size={18} color={Colors.white} />
              <Text style={styles.shareBtnText}>Your Story</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={() => handleShare('close-friends')} disabled={isUploading} style={styles.shareBtn}>
            <LinearGradient
              colors={['#00B894', '#00CEC9'] as any}
              style={styles.shareBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="heart" size={16} color={Colors.white} />
              <Text style={styles.shareBtnText}>Close Friends</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={() => setShowVisibilitySheet(true)} style={styles.moreBtn}>
            <Ionicons name="ellipsis-horizontal" size={20} color={Colors.white} />
          </Pressable>
        </View>
      </LinearGradient>

      {/* TEXT MODAL */}
      <Modal visible={showTextModal} transparent animationType="fade" statusBarTranslucent>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill}>
          <View style={[styles.textModalContent, { paddingTop: insets.top + Spacing.xl }]}>
            <View style={styles.textModalTop}>
              <Pressable onPress={() => { setShowTextModal(false); setEditTool('none'); }} hitSlop={HitSlop.lg}>
                <Ionicons name="close" size={26} color={Colors.white} />
              </Pressable>
              <Text style={styles.textModalTitle}>Add Text</Text>
              <Pressable onPress={commitText} hitSlop={HitSlop.lg}>
                <Text style={styles.textModalDone}>Done</Text>
              </Pressable>
            </View>
            <TextInput
              style={[styles.textModalInput, { color: textColor, fontWeight: textBold ? '700' : '400' }]}
              placeholder="Type something..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={textInput}
              onChangeText={setTextInput}
              autoFocus
              multiline
              textAlign="center"
            />
            <View style={styles.textModalColors}>
              {TEXT_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setTextColor(c)}
                  style={[styles.textColorBtn, { backgroundColor: c }, textColor === c && styles.textColorBtnSelected]}
                />
              ))}
            </View>
            <View style={styles.textStyleRow}>
              <Pressable onPress={() => setTextBold((b) => !b)} style={[styles.textStyleBtn, textBold && styles.textStyleBtnActive]}>
                <Text style={styles.textStyleBtnLabel}>Bold</Text>
              </Pressable>
            </View>
          </View>
        </BlurView>
      </Modal>

      {/* STICKER MODAL */}
      <Modal visible={showStickerModal} transparent animationType="slide" statusBarTranslucent>
        <Pressable style={styles.sheetOverlay} onPress={() => { setShowStickerModal(false); setEditTool('none'); }}>
          <Animated.View entering={FadeIn.duration(200)} style={[styles.stickerSheet, { paddingBottom: insets.bottom + Spacing.md }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Stickers</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {STICKER_ROWS.map((row, ri) => (
                <View key={ri} style={styles.stickerRow}>
                  {row.map((emoji) => (
                    <Pressable key={emoji} onPress={() => addEmoji(emoji)} style={styles.stickerCell}>
                      <Text style={styles.stickerEmoji}>{emoji}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* AUDIO PICKER MODAL */}
      <Modal visible={showAudioModal} transparent animationType="slide" statusBarTranslucent>
        <Pressable style={styles.sheetOverlay} onPress={() => setShowAudioModal(false)}>
          <Animated.View
            entering={FadeIn.duration(200)}
            style={[styles.audioSheet, { paddingBottom: insets.bottom + Spacing.md }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add Music</Text>
            <TextInput
              style={styles.audioSearchInput}
              placeholder="Search songs..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={audioSearch}
              onChangeText={handleAudioSearch}
              returnKeyType="search"
            />
            {/* Remove audio option */}
            {selectedAudio && (
              <Pressable
                style={styles.audioRemoveRow}
                onPress={() => { setSelectedAudio(null); setShowAudioModal(false); Haptics.selectionAsync(); }}
              >
                <Ionicons name="close-circle" size={20} color="#FF6B6B" />
                <Text style={styles.audioRemoveText}>Remove music</Text>
              </Pressable>
            )}
            {audioLoading ? (
              <View style={styles.audioLoadingBox}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : audioTracks.length === 0 ? (
              <View style={styles.audioLoadingBox}>
                <Ionicons name="musical-notes-outline" size={36} color="rgba(255,255,255,0.3)" />
                <Text style={styles.audioEmptyText}>No tracks found</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {audioTracks.map((track) => (
                  <Pressable
                    key={track._id}
                    style={[styles.audioTrackRow, selectedAudio?._id === track._id && styles.audioTrackRowActive]}
                    onPress={() => { setSelectedAudio(track); setShowAudioModal(false); Haptics.selectionAsync(); }}
                  >
                    <View style={styles.audioTrackIcon}>
                      <Ionicons name="musical-note" size={20} color={selectedAudio?._id === track._id ? Colors.primary : Colors.white} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.audioTrackTitle} numberOfLines={1}>{track.title}</Text>
                      <Text style={styles.audioTrackArtist} numberOfLines={1}>{track.artist}</Text>
                    </View>
                    {selectedAudio?._id === track._id && (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Animated.View>
        </Pressable>
      </Modal>

      {/* VISIBILITY SHEET */}
      <Modal visible={showVisibilitySheet} transparent animationType="slide" statusBarTranslucent>
        <Pressable style={styles.sheetOverlay} onPress={() => setShowVisibilitySheet(false)}>
          <Animated.View entering={FadeIn.duration(200)} style={[styles.stickerSheet, { paddingBottom: insets.bottom + Spacing.md }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Share To</Text>
            {VISIBILITY_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => { setShowVisibilitySheet(false); handleShare(opt.value); }}
                style={styles.visibilityRow}
              >
                <View style={styles.visibilityIcon}>
                  <Ionicons name={opt.icon} size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.visibilityLabel}>{opt.label}</Text>
                  <Text style={styles.visibilityDesc}>{opt.desc}</Text>
                </View>
              </Pressable>
            ))}
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },

  // Permissions
  permScreen: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl },
  permTitle: { fontSize: Typography.size.xl, fontFamily: Typography.fontFamily.bold, color: Colors.white, marginBottom: Spacing.sm, textAlign: 'center' },
  permDesc: { fontSize: Typography.size.base, fontFamily: Typography.fontFamily.regular, color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 22 },
  permBtn: { width: '100%', borderRadius: Radii.full, overflow: 'hidden', marginBottom: Spacing.md },
  permBtnGradient: { paddingVertical: 14, alignItems: 'center' },
  permBtnText: { fontSize: 16, fontFamily: Typography.fontFamily.semiBold, color: Colors.white },
  permGallery: { paddingVertical: Spacing.sm },
  permGalleryText: { fontSize: Typography.size.base, fontFamily: Typography.fontFamily.regular, color: Colors.white, textAlign: 'center' },

  // Camera
  camTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
  },
  camTopRight: { flexDirection: 'row', gap: Spacing.sm },
  camIconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.38)',
    justifyContent: 'center', alignItems: 'center',
  },
  arStrip: { position: 'absolute', bottom: 148, left: 0, right: 0 },
  arStripContent: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  arEffectBtn: {
    alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radii.lg, backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 1.5, borderColor: 'transparent', minWidth: 58,
  },
  arEffectBtnActive: { backgroundColor: 'rgba(108,92,231,0.45)', borderColor: Colors.primary },
  arEffectIcon: { fontSize: 24 },
  arEffectLabel: { fontSize: 10, fontFamily: Typography.fontFamily.regular, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  camBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingHorizontal: Spacing.xl,
  },
  camSideBtn: { alignItems: 'center', width: 64 },
  camSideBtnInner: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  camSideLabel: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: 'rgba(255,255,255,0.75)', marginTop: 5 },
  captureWrapper: { alignItems: 'center' },
  captureRing: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 3, borderColor: Colors.white,
    justifyContent: 'center', alignItems: 'center',
  },
  captureInner: { width: 70, height: 70, borderRadius: 35, backgroundColor: Colors.white },
  captureHint: { fontSize: 10, fontFamily: Typography.fontFamily.regular, color: 'rgba(255,255,255,0.55)', marginTop: 7, letterSpacing: 1.5 },
  arOverlayEmoji: { position: 'absolute', textAlign: 'center' },

  // Preview
  previewTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingBottom: Spacing.lg,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
  },
  previewTopLeft: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  previewTopBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'center', alignItems: 'center',
  },
  previewToolbar: { flexDirection: 'row', gap: Spacing.sm },
  toolBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  toolBtnActive: { borderColor: Colors.primary, backgroundColor: 'rgba(108,92,231,0.22)' },
  toolBtnText: { fontSize: 13, fontFamily: Typography.fontFamily.semiBold, color: Colors.white },
  toolIconEmoji: { fontSize: 20 },

  // Drawing
  drawPalette: {
    position: 'absolute', right: Spacing.md,
    flexDirection: 'column', gap: 8, alignItems: 'center',
  },
  drawColorBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  drawColorBtnSelected: { borderColor: Colors.white, transform: [{ scale: 1.22 }] },
  drawSizeRow: { marginTop: 8, gap: 6, alignItems: 'center' },
  drawSizeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  drawSizeBtnSelected: { borderColor: Colors.white },
  drawDot: { position: 'absolute' },

  // Filters
  filterStrip: { position: 'absolute', bottom: 148, left: 0, right: 0 },
  filterStripContent: { paddingHorizontal: Spacing.md, gap: Spacing.md, alignItems: 'center' },
  filterBtn: { alignItems: 'center', gap: 4 },
  filterThumb: { width: 50, height: 50, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  filterThumbActive: { borderColor: Colors.primary },
  filterCheck: {
    position: 'absolute', bottom: 3, right: 3,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  filterLabel: { fontSize: 10, fontFamily: Typography.fontFamily.regular, color: 'rgba(255,255,255,0.55)' },

  // Preview bottom
  previewBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingTop: Spacing.xl, paddingHorizontal: Spacing.md,
  },
  captionRow: { marginBottom: Spacing.sm },
  captionInput: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: Radii.lg, paddingHorizontal: Spacing.md, paddingVertical: 10,
    color: Colors.white, fontSize: Typography.size.base, fontFamily: Typography.fontFamily.regular,
  },
  uploadTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginBottom: Spacing.sm, overflow: 'hidden' },
  uploadFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  shareRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  shareBtn: { flex: 1, borderRadius: Radii.full, overflow: 'hidden' },
  shareBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 13,
  },
  shareBtnText: { fontSize: 13, fontFamily: Typography.fontFamily.semiBold, color: Colors.white },
  moreBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Text overlays
  textOverlayWrapper: { position: 'absolute', left: 0, right: 0, top: '40%', alignItems: 'center' },
  textOverlayText: { fontSize: 26, textAlign: 'center', paddingHorizontal: Spacing.md },
  emojiStickerOnCanvas: { position: 'absolute', fontSize: 40 },

  // Text modal
  textModalContent: { flex: 1, paddingHorizontal: Spacing.md },
  textModalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  textModalTitle: { fontSize: Typography.size.lg, fontFamily: Typography.fontFamily.bold, color: Colors.white },
  textModalDone: { fontSize: 16, fontFamily: Typography.fontFamily.semiBold, color: Colors.primary },
  textModalInput: { flex: 1, fontSize: 28, textAlign: 'center', textAlignVertical: 'center' },
  textModalColors: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  textColorBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  textColorBtnSelected: { borderColor: Colors.white, transform: [{ scale: 1.2 }] },
  textStyleRow: { flexDirection: 'row', justifyContent: 'center', paddingBottom: Spacing.xl },
  textStyleBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radii.lg, backgroundColor: 'rgba(255,255,255,0.15)' },
  textStyleBtnActive: { backgroundColor: Colors.primary },
  textStyleBtnLabel: { fontSize: Typography.size.base, fontFamily: Typography.fontFamily.semiBold, color: Colors.white },

  // Shared sheet
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  stickerSheet: {
    backgroundColor: '#16213E', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: Spacing.sm, paddingHorizontal: Spacing.md, maxHeight: SH * 0.6,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)', alignSelf: 'center', marginBottom: Spacing.md },
  sheetTitle: { fontSize: Typography.size.lg, fontFamily: Typography.fontFamily.bold, color: Colors.white, marginBottom: Spacing.md },
  stickerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md },
  stickerCell: { flex: 1, alignItems: 'center', paddingVertical: Spacing.xs },
  stickerEmoji: { fontSize: 34 },

  // Visibility sheet
  visibilityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.md },
  visibilityIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(108,92,231,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  visibilityLabel: { fontSize: Typography.size.base, fontFamily: Typography.fontFamily.semiBold, color: Colors.white },
  visibilityDesc: { fontSize: Typography.size.xs, fontFamily: Typography.fontFamily.regular, color: 'rgba(255,255,255,0.5)', marginTop: 2 },

  // Audio badge (overlaid on preview)
  audioBadge: {
    position: 'absolute', left: Spacing.md, right: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: Radii.full,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xxs, alignSelf: 'flex-start',
  },
  audioBadgeText: {
    fontSize: Typography.size.xs, fontFamily: Typography.fontFamily.medium, color: Colors.white,
    flexShrink: 1,
  },

  // Audio picker sheet
  audioSheet: {
    backgroundColor: '#16213E', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: Spacing.sm, paddingHorizontal: Spacing.md, maxHeight: SH * 0.75,
  },
  audioSearchInput: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: Radii.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    color: Colors.white, fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm,
    marginBottom: Spacing.md,
  },
  audioRemoveRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.sm, marginBottom: Spacing.xs,
  },
  audioRemoveText: {
    fontSize: Typography.size.sm, fontFamily: Typography.fontFamily.medium, color: '#FF6B6B',
  },
  audioLoadingBox: { height: 120, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm },
  audioEmptyText: {
    fontSize: Typography.size.sm, fontFamily: Typography.fontFamily.regular, color: 'rgba(255,255,255,0.4)',
  },
  audioTrackRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm,
    borderRadius: Radii.md, paddingHorizontal: Spacing.xs, gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  audioTrackRowActive: { backgroundColor: 'rgba(108,92,231,0.15)' },
  audioTrackIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center',
  },
  audioTrackTitle: { fontSize: Typography.size.sm, fontFamily: Typography.fontFamily.semiBold, color: Colors.white },
  audioTrackArtist: { fontSize: Typography.size.xs, fontFamily: Typography.fontFamily.regular, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
});
