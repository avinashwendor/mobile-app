import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Colors, AvatarSizes, Radii } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

interface UserAvatarProps {
  uri: string | null | undefined;
  size?: keyof typeof AvatarSizes;
  showOnlineIndicator?: boolean;
  isOnline?: boolean;
  style?: ViewStyle;
}

/**
 * Reusable avatar component with optional online status indicator.
 * Uses expo-image for caching and progressive loading.
 */
export default function UserAvatar({
  uri,
  size = 'md',
  showOnlineIndicator = false,
  isOnline = false,
  style,
}: UserAvatarProps) {
  const { colors } = useTheme();
  const dimension = AvatarSizes[size];
  const indicatorSize = Math.max(10, dimension * 0.25);

  return (
    <View style={[{ width: dimension, height: dimension }, style]}>
      <Image
        source={
          uri
            ? { uri }
            : require('../../assets/images/icon.png')
        }
        style={[
          styles.image,
          {
            width: dimension,
            height: dimension,
            borderRadius: dimension / 2,
            backgroundColor: colors.surfaceElevated,
          },
        ]}
        contentFit="cover"
        transition={200}
      />
      {showOnlineIndicator && isOnline && (
        <View
          style={[
            styles.indicator,
            {
              width: indicatorSize,
              height: indicatorSize,
              borderRadius: indicatorSize / 2,
              borderColor: colors.background,
              bottom: 0,
              right: 0,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    backgroundColor: Colors.emerald,
    borderWidth: 2,
  },
});
