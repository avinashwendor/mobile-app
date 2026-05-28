import React from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withSequence,
} from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../../src/theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ACTIONS = [
  {
    id: 'post',
    title: 'Post',
    description: 'Share photos & videos with your followers',
    icon: 'images-outline' as const,
    gradient: ['#6C5CE7', '#A29BFE'] as const,
    accent: '#6C5CE7',
    route: '/(screens)/create-post',
    tag: 'Photos & Videos',
  },
  {
    id: 'story',
    title: 'Story',
    description: 'Share a moment that disappears in 24 hours',
    icon: 'flash-outline' as const,
    gradient: ['#FD79A8', '#FDCB6E'] as const,
    accent: '#FD79A8',
    route: '/(screens)/create-story',
    tag: '24h • Ephemeral',
  },
  {
    id: 'reel',
    title: 'Reel',
    description: 'Create and share a short vertical video',
    icon: 'film-outline' as const,
    gradient: ['#0984E3', '#00B894'] as const,
    accent: '#0984E3',
    route: '/(screens)/create-reel',
    tag: 'Short-form Video',
  },
] as const;

function ActionCard({ action, index }: { action: typeof ACTIONS[number]; index: number }) {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSequence(
      withSpring(0.96, { damping: 20, stiffness: 400 }),
      withSpring(1, { damping: 12, stiffness: 300 }),
    );
    router.push(action.route as any);
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(400).springify()}
      style={animStyle}
    >
      <Pressable onPress={handlePress} style={styles.cardOuter}>
        {/* Gradient border effect */}
        <LinearGradient
          colors={[...action.gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardBorderGlow}
        />
        <View style={[styles.cardInner, { backgroundColor: isDark ? '#16161F' : '#FFFFFF' }]}>
          {/* Left: icon */}
          <LinearGradient
            colors={[...action.gradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBox}
          >
            <Ionicons name={action.icon} size={28} color={Colors.white} />
          </LinearGradient>

          {/* Middle: text */}
          <View style={styles.cardText}>
            <View style={styles.titleRow}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{action.title}</Text>
              <View style={[styles.tagChip, { backgroundColor: `${action.accent}22` }]}>
                <Text style={[styles.tagText, { color: action.accent }]}>{action.tag}</Text>
              </View>
            </View>
            <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
              {action.description}
            </Text>
          </View>

          {/* Right: arrow */}
          <View style={[styles.arrowBox, { backgroundColor: isDark ? '#1E1E2E' : '#F5F5FA' }]}>
            <Ionicons name="arrow-forward" size={18} color={action.accent} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Create</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          What do you want to share today?
        </Text>
      </Animated.View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Action cards */}
      <View style={styles.cards}>
        {ACTIONS.map((action, index) => (
          <ActionCard key={action.id} action={action} index={index} />
        ))}
      </View>

      {/* Bottom tip */}
      <Animated.View
        entering={FadeInDown.delay(450).duration(400)}
        style={[styles.tipBox, { backgroundColor: isDark ? '#16161F' : '#F0EFF9' }]}
      >
        <Ionicons name="sparkles-outline" size={16} color={Colors.primary} />
        <Text style={[styles.tipText, { color: colors.textSecondary }]}>
          Add trending hashtags to boost your reach
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  title: {
    fontFamily: Typography.fontFamily.extraBold,
    fontSize: 30,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.base,
    marginTop: 6,
  },

  divider: {
    height: 0.5,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.lg,
  },

  cards: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
    flex: 1,
  },

  // Card
  cardOuter: {
    borderRadius: Radii.xl,
    // Tiny outer shadow
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  cardBorderGlow: {
    position: 'absolute',
    inset: 0,
    borderRadius: Radii.xl,
    // 1px gradient "border" achieved by padding
    padding: 1,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.base,
    borderRadius: Radii.xl,
    margin: 1, // sit inside gradient border
  },
  iconBox: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.size.md,
  },
  tagChip: {
    borderRadius: Radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 10,
  },
  cardDesc: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.sm,
    lineHeight: 18,
  },
  arrowBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tip
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.base,
    marginVertical: Spacing.xl,
    padding: Spacing.md,
    borderRadius: Radii.lg,
  },
  tipText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.sm,
    flex: 1,
  },
});
