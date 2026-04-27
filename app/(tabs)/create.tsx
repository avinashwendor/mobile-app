import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../../src/theme/tokens';

const ACTIONS = [
  {
    id: 'post',
    title: 'Post',
    description: 'Share photos and videos with your followers',
    icon: 'images-outline' as const,
    gradient: Colors.gradientPrimary,
    route: '/(screens)/create-post',
  },
  {
    id: 'story',
    title: 'Story',
    description: 'Share a moment that disappears in 24 hours',
    icon: 'flash-outline' as const,
    gradient: Colors.gradientCoral,
    route: '/(screens)/create-story',
  },
  {
    id: 'reel',
    title: 'Reel',
    description: 'Create and share a short vertical video',
    icon: 'film-outline' as const,
    gradient: Colors.gradientAccent,
    route: '/(screens)/create-reel',
  },
] as const;

export default function CreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Create</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          What do you want to share?
        </Text>
      </View>

      <View style={styles.cards}>
        {ACTIONS.map((action, index) => (
          <Animated.View
            key={action.id}
            entering={FadeInDown.delay(index * 90).duration(340).springify()}
          >
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push(action.route as any);
              }}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: isDark ? colors.surface : colors.surfaceElevated,
                  shadowColor: isDark ? Colors.primary : '#000',
                },
                pressed && styles.cardPressed,
              ]}
            >
              <LinearGradient
                colors={[...action.gradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardIconWrap}
              >
                <Ionicons name={action.icon} size={26} color={Colors.white} />
              </LinearGradient>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{action.title}</Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                  {action.description}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  title: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.size.xxl,
  },
  subtitle: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.base,
    marginTop: 6,
  },

  cards: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.base,
    borderRadius: Radii.xl,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  cardPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.975 }],
  },
  cardIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 5,
  },
  cardTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.size.md,
  },
  cardDesc: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.sm,
    lineHeight: 18,
  },
});

