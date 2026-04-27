import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  Dimensions, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../../src/theme/tokens';
import { useAuthStore } from '../../src/stores/authStore';
import analyticsApi, { type AnalyticsRow, type ProfileSummary, type TopContentItem } from '../../src/api/analytics.api';
import { compactNumber } from '../../src/utils/formatters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WINDOW_DAYS = 30;

interface AggregatedAnalytics {
  totalReach: number;
  totalImpressions: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  followersGrowth: number;
  profileVisits: number;
  storyViews: number;
  reelViews: number;
  engagementRate: number;
}

const EMPTY_AGGREGATE: AggregatedAnalytics = {
  totalReach: 0,
  totalImpressions: 0,
  totalLikes: 0,
  totalComments: 0,
  totalShares: 0,
  totalSaves: 0,
  followersGrowth: 0,
  profileVisits: 0,
  storyViews: 0,
  reelViews: 0,
  engagementRate: 0,
};

const aggregate = (rows: AnalyticsRow[]): AggregatedAnalytics => {
  if (rows.length === 0) return EMPTY_AGGREGATE;
  let totalReach = 0;
  let totalImpressions = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;
  let totalSaves = 0;
  let followersGained = 0;
  let followersLost = 0;
  let profileVisits = 0;
  let storyViews = 0;
  let reelViews = 0;

  for (const row of rows) {
    totalReach += Number(row.reach ?? 0);
    totalImpressions += Number(row.impressions ?? 0);
    totalLikes += Number(row.engagement?.likes_received ?? 0);
    totalComments += Number(row.engagement?.comments_received ?? 0);
    totalShares += Number(row.engagement?.shares_received ?? 0);
    totalSaves += Number(row.engagement?.saves_received ?? 0);
    followersGained += Number(row.followers_gained ?? 0);
    followersLost += Number(row.followers_lost ?? 0);
    profileVisits += Number(row.profile_visits ?? 0);
    storyViews += Number(row.story_views ?? 0);
    reelViews += Number(row.reel_views ?? 0);
  }

  const totalEngagement = totalLikes + totalComments + totalShares + totalSaves;
  const denominator = totalReach > 0 ? totalReach : totalImpressions;
  const engagementRate = denominator > 0 ? totalEngagement / denominator : 0;

  return {
    totalReach,
    totalImpressions,
    totalLikes,
    totalComments,
    totalShares,
    totalSaves,
    followersGrowth: followersGained - followersLost,
    profileVisits,
    storyViews,
    reelViews,
    engagementRate,
  };
};

export default function InsightsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);

  const [rows, setRows] = useState<AnalyticsRow[]>([]);
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      const [analyticsRows, profileSummary] = await Promise.all([
        analyticsApi.getMyAnalytics(WINDOW_DAYS),
        analyticsApi.getProfileSummary(),
      ]);
      setRows(analyticsRows);
      setSummary(profileSummary);
      setError(null);
    } catch {
      setRows([]);
      setError('Insights are unavailable right now. Try again later.');
    }
  }, []);

  useEffect(() => {
    fetchAnalytics().finally(() => setIsLoading(false));
  }, [fetchAnalytics]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchAnalytics();
    setIsRefreshing(false);
  }, [fetchAnalytics]);

  const totals = useMemo(() => aggregate(rows), [rows]);
  const followersCount = user?.followersCount ?? 0;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const stats: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; gradient: [string, string] }[] = [
    { label: 'Reach', value: totals.totalReach, icon: 'eye-outline', gradient: ['#6C5CE7', '#A29BFE'] },
    { label: 'Impressions', value: totals.totalImpressions, icon: 'stats-chart-outline', gradient: ['#0984E3', '#74B9FF'] },
    { label: 'Likes', value: totals.totalLikes, icon: 'heart-outline', gradient: ['#FD79A8', '#FDCB6E'] },
    { label: 'Followers', value: followersCount, icon: 'people-outline', gradient: ['#00B894', '#55EFC4'] },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Insights</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
      >
        <Animated.View entering={FadeInDown.delay(100)}>
          <Text style={[styles.periodLabel, { color: colors.textSecondary }]}>Last {WINDOW_DAYS} days</Text>
        </Animated.View>

        {error ? (
          <View style={[styles.errorCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Ionicons name="alert-circle-outline" size={20} color="#E17264" />
            <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.statsGrid}>
          {stats.map((stat, i) => (
            <Animated.View key={stat.label} entering={FadeInDown.delay(150 + i * 80)} style={styles.statCardWrapper}>
              <View style={[styles.statCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <LinearGradient colors={stat.gradient} style={styles.statIconBg}>
                  <Ionicons name={stat.icon} size={18} color={Colors.white} />
                </LinearGradient>
                <Text style={[styles.statValue, { color: colors.text }]}>{compactNumber(stat.value)}</Text>
                <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{stat.label}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={FadeInDown.delay(500)} style={[styles.engagementCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.engagementHeader}>
            <View>
              <Text style={[styles.engagementLabel, { color: colors.textSecondary }]}>Engagement Rate</Text>
              <Text style={[styles.engagementValue, { color: colors.text }]}>
                {(totals.engagementRate * 100).toFixed(1)}%
              </Text>
            </View>
            <View style={[styles.growthBadge, { backgroundColor: totals.followersGrowth >= 0 ? 'rgba(0,184,148,0.15)' : 'rgba(225,114,100,0.15)' }]}>
              <Ionicons
                name={totals.followersGrowth >= 0 ? 'trending-up' : 'trending-down'}
                size={16}
                color={totals.followersGrowth >= 0 ? Colors.emerald : '#E17264'}
              />
              <Text style={[styles.growthText, { color: totals.followersGrowth >= 0 ? Colors.emerald : '#E17264' }]}>
                {totals.followersGrowth >= 0 ? '+' : ''}{totals.followersGrowth}
              </Text>
            </View>
          </View>
          <View style={styles.barContainer}>
            <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
              <LinearGradient
                colors={[...Colors.gradientPrimary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.barFill, { width: `${Math.min(totals.engagementRate * 100, 100)}%` }]}
              />
            </View>
          </View>

          <View style={styles.engagementGrid}>
            <EngagementStat label="Comments" value={totals.totalComments} colors={colors} />
            <EngagementStat label="Shares" value={totals.totalShares} colors={colors} />
            <EngagementStat label="Saves" value={totals.totalSaves} colors={colors} />
            <EngagementStat label="Profile visits" value={totals.profileVisits} colors={colors} />
          </View>
        </Animated.View>

        {/* Content Breakdown */}
        <Animated.View entering={FadeInDown.delay(600)}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Content Breakdown</Text>
          <View style={[styles.infoCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <InfoRow label="Story Views" value={compactNumber(totals.storyViews)} colors={colors} />
            <InfoRow label="Reel Views" value={compactNumber(totals.reelViews)} colors={colors} />
            <InfoRow label="Total Impressions" value={compactNumber(totals.totalImpressions)} colors={colors} isLast />
          </View>
        </Animated.View>

        {/* Top Content */}
        {summary && summary.topContent.length > 0 && (
          <Animated.View entering={FadeInDown.delay(650)}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Content</Text>
              <Text style={[styles.sectionSub, { color: colors.textTertiary }]}>Last 30 days</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topContentScroll} contentContainerStyle={{ paddingRight: Spacing.base }}>
              {summary.topContent.map((item, idx) => (
                <TopContentCard
                  key={item.content_id + idx}
                  item={item}
                  colors={colors}
                  onPress={() =>
                    router.push({
                      pathname: '/(screens)/content-insights',
                      params: { type: item.content_type, id: item.content_id },
                    })
                  }
                />
              ))}
            </ScrollView>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(700)}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <ActionCard icon="add-circle-outline" label="Create Post" color={Colors.primary} onPress={() => router.push('/(tabs)/create')} colors={colors} />
            <ActionCard icon="videocam-outline" label="Go Live" color={Colors.coral} onPress={() => {}} colors={colors} />
            <ActionCard icon="megaphone-outline" label="Promote" color={Colors.accent} onPress={() => router.push('/(screens)/promotions')} colors={colors} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(700)}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
          <View style={[styles.infoCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <InfoRow label="Username" value={`@${user?.username ?? ''}`} colors={colors} />
            <InfoRow label="Account Type" value={user?.accountType ?? 'personal'} colors={colors} />
            <InfoRow label="Posts" value={compactNumber(user?.postsCount ?? 0)} colors={colors} />
            <InfoRow label="Following" value={compactNumber(user?.followingCount ?? 0)} colors={colors} isLast />
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function TopContentCard({ item, colors, onPress }: { item: TopContentItem; colors: any; onPress: () => void }) {
  const typeColor = item.content_type === 'reel' ? Colors.coral : Colors.primary;
  return (
    <Pressable
      style={[styles.topContentCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
      onPress={onPress}
    >
      {item.thumbnail_url ? (
        <Image source={{ uri: item.thumbnail_url }} style={styles.topContentThumb} contentFit="cover" />
      ) : (
        <View style={[styles.topContentThumb, { backgroundColor: typeColor + '20', alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name={item.content_type === 'reel' ? 'videocam' : 'image'} size={24} color={typeColor} />
        </View>
      )}
      <View style={[styles.topContentBadge, { backgroundColor: typeColor }]}>
        <Text style={styles.topContentBadgeText}>{item.content_type.charAt(0).toUpperCase() + item.content_type.slice(1)}</Text>
      </View>
      <View style={styles.topContentMeta}>
        <Text style={[styles.topContentViews, { color: colors.text }]}>{compactNumber(item.views)} views</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
      </View>
    </Pressable>
  );
}

function EngagementStat({ label, value, colors }: { label: string; value: number; colors: any }) {
  return (
    <View style={styles.engagementStat}>
      <Text style={[styles.engagementStatValue, { color: colors.text }]}>{compactNumber(value)}</Text>
      <Text style={[styles.engagementStatLabel, { color: colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

function ActionCard({ icon, label, color, onPress, colors }: any) {
  return (
    <Pressable style={[styles.actionCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]} onPress={onPress}>
      <View style={[styles.actionIconBg, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({ label, value, colors, isLast }: any) {
  return (
    <View style={[styles.infoRow, !isLast && { borderBottomWidth: 0.5, borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, borderBottomWidth: 0.5 },
  headerTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.lg },
  content: { padding: Spacing.base, paddingBottom: 40 },
  periodLabel: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm, marginBottom: Spacing.md },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radii.md, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.md },
  errorText: { flex: 1, fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCardWrapper: { width: (SCREEN_WIDTH - Spacing.base * 2 - Spacing.sm) / 2 },
  statCard: { borderRadius: Radii.lg, padding: Spacing.base, borderWidth: 1, gap: Spacing.sm },
  statIconBg: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.xl },
  statLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },
  engagementCard: { borderRadius: Radii.lg, padding: Spacing.base, borderWidth: 1, marginBottom: Spacing.xl },
  engagementHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  engagementLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm },
  engagementValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.xxl, marginTop: 2 },
  growthBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  growthText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  barContainer: { marginTop: Spacing.sm, marginBottom: Spacing.md },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  engagementGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.sm },
  engagementStat: { width: '50%', paddingVertical: Spacing.sm },
  engagementStatValue: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },
  engagementStatLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, marginTop: 2 },
  sectionTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md, marginBottom: Spacing.sm },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  sectionSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },
  topContentScroll: { marginBottom: Spacing.xl },
  topContentCard: { width: 130, borderRadius: Radii.lg, borderWidth: 1, overflow: 'hidden', marginRight: Spacing.sm },
  topContentThumb: { width: 130, height: 100 },
  topContentBadge: { position: 'absolute', top: Spacing.xs, left: Spacing.xs, borderRadius: Radii.sm, paddingHorizontal: Spacing.xs, paddingVertical: 2 },
  topContentBadgeText: { fontFamily: Typography.fontFamily.semiBold, fontSize: 10, color: '#fff' },
  topContentMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  topContentViews: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.xs },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  actionCard: { flex: 1, borderRadius: Radii.lg, padding: Spacing.base, alignItems: 'center', gap: Spacing.sm, borderWidth: 1 },
  actionIconBg: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.xs, textAlign: 'center' },
  infoCard: { borderRadius: Radii.lg, borderWidth: 1, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  infoLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm },
  infoValue: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm, textTransform: 'capitalize' },
});
