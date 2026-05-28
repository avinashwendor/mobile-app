import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Modal,
  ScrollView, Switch, Animated, TouchableWithoutFeedback,
  KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics'
import { useTheme } from '../theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../theme/tokens';
import type { Post } from '../api/post.api';
import * as postApi from '../api/post.api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface EditPostModalProps {
  visible: boolean;
  post: Post;
  onClose: () => void;
  /** Called with the updated post after a successful save */
  onSaved: (updatedPost: Post) => void;
}

export default function EditPostModal({
  visible, post, onClose, onSaved,
}: EditPostModalProps) {
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const [caption, setCaption] = useState(post.caption);
  const [commentsDisabled, setCommentsDisabled] = useState(post.commentsDisabled);
  const [hideLikesCount, setHideLikesCount] = useState(post.hideLikesCount);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Reset state when post changes
  useEffect(() => {
    setCaption(post.caption);
    setCommentsDisabled(post.commentsDisabled);
    setHideLikesCount(post.hideLikesCount);
    setError(null);
    setSaveSuccess(false);
  }, [post._id, post.caption, post.commentsDisabled, post.hideLikesCount]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 22,
          stiffness: 260,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const isDirty =
    caption !== post.caption ||
    commentsDisabled !== post.commentsDisabled ||
    hideLikesCount !== post.hideLikesCount;

  const handleSave = async () => {
    if (!isDirty) { onClose(); return; }
    setError(null);
    setSaveSuccess(false);
    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const updated = await postApi.updatePost(post._id, {
        caption,
        commentsDisabled,
        hideLikesCount,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaveSuccess(true);
      // Brief pause to show success state, then close
      setTimeout(() => {
        onSaved(updated);
      }, 400);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        {/* Backdrop — tap to dismiss (unless saving) */}
        <TouchableWithoutFeedback onPress={isSaving ? undefined : onClose}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </TouchableWithoutFeedback>

        {/* Bottom sheet — absolutely pinned so it always shows fully */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle bar */}
          <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Pressable onPress={onClose} style={styles.headerSideBtn} disabled={isSaving}>
              <Text style={[styles.headerCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Post</Text>
            <Pressable onPress={handleSave} style={styles.headerSideBtn} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : saveSuccess ? (
                <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
              ) : (
                <Text
                  style={[
                    styles.headerSaveText,
                    { color: isDirty ? Colors.primary : colors.textTertiary },
                  ]}
                >
                  Save
                </Text>
              )}
            </Pressable>
          </View>

          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              style={styles.scrollContent}
              contentContainerStyle={styles.scrollContentContainer}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Caption */}
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Caption</Text>
                <View
                  style={[
                    styles.captionInputWrapper,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: isDirty && caption !== post.caption
                        ? Colors.primary + '60'
                        : colors.border,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.captionInput, { color: colors.text }]}
                    value={caption}
                    onChangeText={setCaption}
                    multiline
                    maxLength={2200}
                    placeholder="Write a caption..."
                    placeholderTextColor={colors.textTertiary}
                    textAlignVertical="top"
                    editable={!isSaving}
                  />
                  <Text style={[styles.charCount, { color: colors.textTertiary }]}>
                    {caption.length}/2200
                  </Text>
                </View>
              </View>

              {/* Settings */}
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Settings</Text>

                <View
                  style={[
                    styles.settingsCard,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  ]}
                >
                  {/* Comments toggle */}
                  <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                    <View style={styles.settingInfo}>
                      <View
                        style={[
                          styles.settingIconWrapper,
                          { backgroundColor: Colors.primary + '20' },
                        ]}
                      >
                        <Ionicons name="chatbubble-outline" size={18} color={Colors.primary} />
                      </View>
                      <View style={styles.settingTextBlock}>
                        <Text style={[styles.settingTitle, { color: colors.text }]}>
                          Turn off commenting
                        </Text>
                        <Text style={[styles.settingDesc, { color: colors.textTertiary }]}>
                          No one can comment on this post
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={commentsDisabled}
                      onValueChange={setCommentsDisabled}
                      trackColor={{ false: colors.border, true: Colors.primary + '60' }}
                      thumbColor={commentsDisabled ? Colors.primary : colors.textTertiary}
                      disabled={isSaving}
                    />
                  </View>

                  {/* Likes count toggle */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <View
                        style={[
                          styles.settingIconWrapper,
                          { backgroundColor: Colors.likeFilled + '20' },
                        ]}
                      >
                        <Ionicons name="heart-outline" size={18} color={Colors.likeFilled} />
                      </View>
                      <View style={styles.settingTextBlock}>
                        <Text style={[styles.settingTitle, { color: colors.text }]}>
                          Hide like count
                        </Text>
                        <Text style={[styles.settingDesc, { color: colors.textTertiary }]}>
                          Others can't see how many likes
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={hideLikesCount}
                      onValueChange={setHideLikesCount}
                      trackColor={{ false: colors.border, true: Colors.primary + '60' }}
                      thumbColor={hideLikesCount ? Colors.primary : colors.textTertiary}
                      disabled={isSaving}
                    />
                  </View>
                </View>
              </View>

              {/* Error */}
              {error && (
                <View
                  style={[
                    styles.errorBanner,
                    {
                      backgroundColor: Colors.error + '18',
                      borderColor: Colors.error + '40',
                    },
                  ]}
                >
                  <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
                  <Text style={[styles.errorText, { color: Colors.error }]}>{error}</Text>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // Use a generous max height so the sheet is always fully visible
    maxHeight: '92%',
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 24,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: 0.5,
  },
  headerSideBtn: { minWidth: 64 },
  headerTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.base,
    textAlign: 'center',
  },
  headerCancelText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.base,
  },
  headerSaveText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.base,
    textAlign: 'right',
  },
  scrollContent: { flex: 1 },
  scrollContentContainer: {
    padding: Spacing.base,
    gap: Spacing.xl,
    paddingBottom: 52,
  },
  section: { gap: Spacing.sm },
  sectionLabel: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.xs,
  },
  captionInputWrapper: {
    borderRadius: Radii.lg,
    borderWidth: 1.5,
    padding: Spacing.md,
  },
  captionInput: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.base,
    lineHeight: 22,
    minHeight: 120,
    maxHeight: 200,
  },
  charCount: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.xs,
    textAlign: 'right',
    marginTop: Spacing.sm,
  },
  settingsCard: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
    marginRight: Spacing.md,
  },
  settingTextBlock: {
    flex: 1,
  },
  settingIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.size.sm,
  },
  settingDesc: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.xs,
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  errorText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.sm,
    flex: 1,
  },
});
