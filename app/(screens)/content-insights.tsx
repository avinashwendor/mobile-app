import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../../src/theme/tokens';
import analyticsApi, { type ContentInsights } from '../../src/api/analytics.api';
import { compactNumber } from '../../src/utils/formatters';

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentType = 'post' | 'reel' | 'story';

const TYPE_LABEL: Record<ContentType, string> = {
  post: 'Post',
  reel: 'Reel',
  story: 'Story',
};

const TYPE_ICON: Record<ContentType, keyof typeof Ionicons.glyphMap> = {
  post: 'image-outline',
  reel: 'videocam-outline',
  story: 'time-outline',
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ContentInsightsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const params = useLocalSearchParams<{ type: string; id: string }>();
  const contentType = (params.type ?? 'post') as ContentType;
  const contentId = params.id ?? '';

  const [insights, setInsights] = useState<ContentInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const data = await analyticsApi.getContentInsights(contentType, contentId);
      setInsights(data);
      setError(null);
    } catch {
      setError('Could not load content insights. Try again later.');
    }
  }, [contentType, contentId]);

  useEffect(() => {
    fetch().finally(() => setIsLoading(false));
  }, [fetch]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetch();
    setIsRefreshing(false);
  }, [fetch]);

  const totals = insights?.totals;
  const hasVideo = contentType === 'reel';

  // ─── Traffic sources total for bar widths ────────────────────────────────
  const sourceTotal = totals
    ? (totals.source_home ?? 0) + (totals.source_profile ?? 0) +
      (totals.source_explore ?? 0) + (totals.source_other ?? 0)
    : 0;

  const engagementRate =
    totals && (totals.views ?? 0) > 0
      ? ((totals.likes ?? 0) + (totals.comments ?? 0) + (totals.shares ?? 0) + (totals.saves ?? 0)) /
        (totals.views ?? 1)
      : 0;

  if (isLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Ionicons name={TYPE_ICON[contentType]} size={18} color={Colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {TYPE_LABEL[contentType]} Insights
          </Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.textTertiary} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero metrics */}
          <Animated.View entering={FadeInDown.delay(100)}>
            <LinearGradient
              colors={[...Colors.gradientPrimary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <Text style={styles.heroLabel}>Total Views</Text>
              <Text style={styles.heroValue}>{compactNumber(totals?.views ?? 0)}</Text>
              <Text style={styles.heroSub}>
                {compactNumber(totals?.unique_views ?? 0)} unique viewers
              </Text>
            </LinearGradient>
          </Animated.View>

          {/* Engagement grid */}
          <Animated.View entering={FadeInDown.delay(200)}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Engagement</Text>
            <View style={styles.metricsGrid}>
              <MetricCard
                icon="heart-outline"
                label="Likes"
                value={totals?.likes ?? 0}
                color={Colors.coral}
                colors={colors}
              />
              <MetricCard
                icon="chatbubble-outline"
                label="Comments"
                value={totals?.comments ?? 0}
                color={Colors.accent}
                colors={colors}
              />
              <MetricCard
                icon="arrow-redo-outline"
                label="Shares"
                value={totals?.shares ?? 0}
                color={Colors.emerald}
                colors={colors}
              />
              <MetricCard
                icon="bookmark-outline"
                label="Saves"
                value={totals?.saves ?? 0}
                color={Colors.amber}
                colors={colors}
              />
            </View>
          </Animated.View>

          {/* Engagement rate */}
          <Animated.View entering={FadeInDown.delay(300)} style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <View style={styles.cardRow}>
              <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Engagement Rate</Text>
              <Text style={[styles.cardValue, { color: colors.text }]}>
                {(engagementRate * 100).toFixed(1)}%
              </Text>
            </View>
            <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
              <LinearGradient
                colors={[...Colors.gradientPrimary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.barFill, { width: `${Math.min(engagementRate * 100, 100)}%` }]}
              />
            </View>
          </Animated.View>

          {/* Video-specific metrics */}
          {hasVideo && (
            <Animated.View entering={FadeInDown.delay(350)}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Video Performance</Text>
              <View style={styles.metricsGrid}>
                <MetricCard
                  icon="time-outline"
                  label="Avg Watch"
                  value={totals?.avg_watch_time ?? 0}
                  suffix="s"
                  color={Colors.primaryLight}
                  colors={colors}
                />
                <MetricCard
                  icon="checkmark-circle-outline"
                  label="Completion"
                  value={Math.round((totals?.completion_rate ?? 0) * 100)}
                  suffix="%"
                  color={Colors.emerald}
                  colors={colors}
                />
              </View>
            </Animated.View>
          )}

          {/* Traffic sources */}
          <Animated.View entering={FadeInDown.delay(400)}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Traffic Sources</Text>
            <View style={[styles.sourcesCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <SourceBar label="Home Feed" count={totals?.source_home ?? 0} total={sourceTotal} color={Colors.primary} colors={colors} />
              <SourceBar label="Profile" count={totals?.source_profile ?? 0} total={sourceTotal} color={Colors.accent} colors={colors} />
              <SourceBar label="Explore" count={totals?.source_explore ?? 0} total={sourceTotal} color={Colors.coral} colors={colors} />
              <SourceBar label="Other" count={totals?.source_other ?? 0} total={sourceTotal} color={colors.textTertiary} colors={colors} isLast />
            </View>
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  icon, label, value, suffix = '', color, colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  suffix?: string;
  color: string;
  colors: any;
}) {
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <View style={[styles.metricIconBg, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>
        {suffix === '%' || suffix === 's' ? `${value}${suffix}` : compactNumber(value)}
      </Text>
      <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

function SourceBar({
  label, count, total, color, colors, isLast = false,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  colors: any;
  isLast?: boolean;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <View style={[styles.sourceRow, !isLast && { borderBottomWidth: 0.5, borderBottomColor: colors.border }]}>
      <Text style={[styles.sourceLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.sourceBarWrap}>
        <View style={[styles.sourceTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.sourceFill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
        <Text style={[styles.sourcePct, { color: colors.textTertiary }]}>{pct.toFixed(0)}%</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, borderBottomWidth: 0.5,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  headerTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.lg },
  scroll: { flex: 1 },
  content: { padding: Spacing.base },
  errorText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, textAlign: 'center', marginTop: Spacing.sm, paddingHorizontal: Spacing.xl },
  heroCard: { borderRadius: Radii.xl, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.xl },
  heroLabel: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm, color: 'rgba(255,255,255,0.8)', marginBottom: Spacing.xs },
  heroValue: { fontFamily: Typography.fontFamily.bold, fontSize: 48, color: '#fff' },
  heroSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, color: 'rgba(255,255,255,0.7)', marginTop: Spacing.xs },
  sectionTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md, marginBottom: Spacing.md, marginTop: Spacing.sm },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  metricCard: { flex: 1, minWidth: '45%', borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.base, alignItems: 'center', gap: Spacing.xs },
  metricIconBg: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.xl },
  metricLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },
  card: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.base, marginBottom: Spacing.lg },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  cardLabel: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm },
  cardValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.sm },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  sourcesCard: { borderRadius: Radii.lg, borderWidth: 1, overflow: 'hidden', marginBottom: Spacing.lg },
  sourceRow: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  sourceLabel: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm, marginBottom: Spacing.xs },
  sourceBarWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sourceTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  sourceFill: { height: '100%', borderRadius: 3 },
  sourcePct: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.xs, width: 32, textAlign: 'right' },
});
