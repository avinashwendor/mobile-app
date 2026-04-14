import React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { Typography, Spacing, Radii, Colors } from '../theme/tokens';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onClear?: () => void;
  autoFocus?: boolean;
}

/**
 * Search input with glassmorphism styling, animated focus state,
 * and clear button.
 */
export default function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search',
  onFocus,
  onBlur,
  onClear,
  autoFocus = false,
}: SearchBarProps) {
  const { colors } = useTheme();
  const borderOpacity = useSharedValue(0);

  const animatedBorder = useAnimatedStyle(() => ({
    borderColor: `rgba(108, 92, 231, ${borderOpacity.value})`,
  }));

  const handleFocus = () => {
    borderOpacity.value = withTiming(0.6, { duration: 200 });
    onFocus?.();
  };

  const handleBlur = () => {
    borderOpacity.value = withTiming(0, { duration: 200 });
    onBlur?.();
  };

  const handleClear = () => {
    onChangeText('');
    onClear?.();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.surfaceElevated },
        animatedBorder,
      ]}
    >
      <Ionicons
        name="search"
        size={20}
        color={colors.textTertiary}
        style={styles.icon}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, { color: colors.text }]}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable onPress={handleClear} hitSlop={8}>
          <Ionicons
            name="close-circle"
            size={18}
            color={colors.textTertiary}
          />
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  icon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.base,
    padding: 0,
  },
});
