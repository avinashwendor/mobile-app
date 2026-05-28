import React, { useRef, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal,
  Animated, TouchableWithoutFeedback, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../theme/tokens';

export interface PostMenuOption {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  color?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

interface PostOptionsMenuProps {
  visible: boolean;
  onClose: () => void;
  options: PostMenuOption[];
  onSelect: (optionId: string) => void;
  loadingOptionId?: string | null;
}

export default function PostOptionsMenu({
  visible,
  onClose,
  options,
  onSelect,
  loadingOptionId,
}: PostOptionsMenuProps) {
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(300)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 22,
          stiffness: 280,
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
          toValue: 300,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleSelect = (optionId: string) => {
    if (loadingOptionId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(optionId);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalContainer}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={[
              styles.backdrop,
              { opacity: backdropOpacity },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Bottom sheet */}
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.surfaceElevated, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle bar */}
          <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

          {/* Options */}
          <View style={styles.optionsContainer}>
            {options.map((option, index) => {
              const isLast = index === options.length - 1;
              const isLoading = loadingOptionId === option.id;
              const optionColor = option.isDestructive
                ? Colors.error
                : option.color ?? colors.text;

              return (
                <Pressable
                  key={option.id}
                  style={({ pressed }) => [
                    styles.optionRow,
                    !isLast && [styles.optionBorder, { borderBottomColor: colors.border }],
                    pressed && { backgroundColor: colors.surfaceElevated + '88' },
                  ]}
                  onPress={() => handleSelect(option.id)}
                  disabled={!!loadingOptionId}
                >
                  <View style={[styles.optionIconWrapper, { backgroundColor: option.isDestructive ? Colors.error + '18' : colors.border + '60' }]}>
                    {isLoading ? (
                      <ActivityIndicator size="small" color={optionColor} />
                    ) : (
                      <Ionicons name={option.icon} size={20} color={optionColor} />
                    )}
                  </View>
                  <Text style={[styles.optionLabel, { color: optionColor }]}>
                    {option.label}
                  </Text>
                  {!isLoading && (
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Cancel */}
          <Pressable
            style={({ pressed }) => [
              styles.cancelBtn,
              { backgroundColor: colors.border + '80' },
              pressed && { opacity: 0.7 },
            ]}
            onPress={onClose}
            disabled={!!loadingOptionId}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingBottom: 34, // safe area bottom padding
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  optionsContainer: {
    borderRadius: Radii.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  optionBorder: {
    borderBottomWidth: 0.5,
  },
  optionIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    flex: 1,
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.size.base,
  },
  cancelBtn: {
    borderRadius: Radii.lg,
    paddingVertical: Spacing.base,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.base,
  },
});
