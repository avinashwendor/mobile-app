import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';
import { Colors, Typography, Spacing, AvatarSizes } from '../theme/tokens';
import UserAvatar from './UserAvatar';

interface StoryCircleProps {
  userId: string;
  username: string;
  avatarUrl: string | null;
  hasUnseen: boolean;
  isOwnStory?: boolean;
  onPress: (userId: string) => void;
}

/**
 * Story avatar circle with gradient ring for unseen stories.
 * Shows a "+" badge for the user's own story if they have no active story.
 */
export default function StoryCircle({
  userId,
  username,
  avatarUrl,
  hasUnseen,
  isOwnStory = false,
  onPress,
}: StoryCircleProps) {
  const { colors } = useTheme();
  const ringSize = AvatarSizes.lg + 8;

  return (
    <Pressable
      onPress={() => onPress(userId)}
      style={styles.container}
    >
      {hasUnseen ? (
        <LinearGradient
          colors={[...Colors.gradientStory]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.ring,
            { width: ringSize, height: ringSize, borderRadius: ringSize / 2 },
          ]}
        >
          <View
            style={[
              styles.innerRing,
              {
                backgroundColor: colors.background,
                width: ringSize - 4,
                height: ringSize - 4,
                borderRadius: (ringSize - 4) / 2,
              },
            ]}
          >
            <UserAvatar uri={avatarUrl} size="lg" />
          </View>
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.ring,
            {
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderWidth: 2,
              borderColor: colors.border,
            },
          ]}
        >
          <UserAvatar uri={avatarUrl} size="lg" />
        </View>
      )}

      {isOwnStory && !hasUnseen && (
        <View style={[styles.addBadge, { borderColor: colors.background }]}>
          <LinearGradient
            colors={[...Colors.gradientPrimary]}
            style={styles.addBadgeInner}
          >
            <Text style={styles.addBadgeText}>+</Text>
          </LinearGradient>
        </View>
      )}

      <Text
        style={[styles.username, { color: colors.textSecondary }]}
        numberOfLines={1}
      >
        {isOwnStory ? 'Your Story' : username}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 76,
    marginRight: Spacing.sm,
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.xs,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  addBadge: {
    position: 'absolute',
    bottom: 18,
    right: 8,
    borderWidth: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  addBadgeInner: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  addBadgeText: {
    color: Colors.white,
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    lineHeight: 16,
  },
});
