import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  Dimensions, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, Shadows } from '../../src/theme/tokens';
import { useAuthStore } from '../../src/stores/authStore';
import apiClient from '../../src/api/client';
import { compactNumber } from '../../src/utils/formatters';
import { DUMMY_ANALYTICS } from '../../src/data/dummyData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnalyticsData {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalFollowers: number;
  followersGrowth: number;
  engagementRate: number;
  topPosts: any[];
}

export default function InsightsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      const { data: res } = await apiClient.get('/analytics/me', {
        params: { startDate: new Date(Date.now() - 30 * 86400000).toISOString(), endDate: new Date().toISOString() },
      });
      setData(res.data);
    } catch (err) {
      // Fallback to dummy analytics data
      setData({
        totalViews: DUMMY_ANALYTICS.totalViews,
        totalLikes: DUMMY_ANALYTICS.totalLikes,
        totalComments: DUMMY_ANALYTICS.totalComments,
        totalFollowers: DUMMY_ANALYTICS.totalFollowers,
        followersGrowth: DUMMY_ANALYTICS.followersGrowth,
        engagementRate: DUMMY_ANALYTICS.engagementRate,
        topPosts: DUMMY_ANALYTICS.topPosts,
      });
    }
  }, [user]);

  useEffect(() => {
    fetchAnalytics().then(() => setIsLoading(false));
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchAnalytics();
    setIsRefreshing(false);
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const stats = [
    { label: 'Total Views', value: data?.totalViews || 0, icon: 'eye-outline' as const, gradient: ['#6C5CE7', '#A29BFE'] },
    { label: 'Total Likes', value: data?.totalLikes || 0, icon: 'heart-outline' as const, gradient: ['#FD79A8', '#FDCB6E'] },
    { label: 'Comments', value: data?.totalComments || 0, icon: 'chatbubble-outline' as const, gradient: ['#0984E3', '#74B9FF'] },
    { label: 'Followers', value: data?.totalFollowers || 0, icon: 'people-outline' as const, gradient: ['#00B894', '#55EFC4'] },
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
        {/* Period label */}
        <Animated.View entering={FadeInDown.delay(100)}>
          <Text style={[styles.periodLabel, { color: colors.textSecondary }]}>Last 30 days</Text>
        </Animated.View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {stats.map((stat, i) => (
            <Animated.View key={stat.label} entering={FadeInDown.delay(150 + i * 80)} style={styles.statCardWrapper}>
              <View style={[styles.statCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <LinearGradient colors={stat.gradient as [string, string]} style={styles.statIconBg}>
                  <Ionicons name={stat.icon} size={18} color={Colors.white} />
                </LinearGradient>
                <Text style={[styles.statValue, { color: colors.text }]}>{compactNumber(stat.value)}</Text>
                <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{stat.label}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Engagement rate */}
        <Animated.View entering={FadeInDown.delay(500)} style={[styles.engagementCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.engagementHeader}>
            <View>
              <Text style={[styles.engagementLabel, { color: colors.textSecondary }]}>Engagement Rate</Text>
              <Text style={[styles.engagementValue, { color: colors.text }]}>
                {((data?.engagementRate || 0) * 100).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.growthBadge}>
              <Ionicons name="trending-up" size={16} color={Colors.emerald} />
              <Text style={styles.growthText}>+{data?.followersGrowth || 0}</Text>
            </View>
          </View>
          {/* Simple bar visualization */}
          <View style={styles.barContainer}>
            <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
              <LinearGradient
                colors={[...Colors.gradientPrimary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.barFill, { width: `${Math.min((data?.engagementRate || 0) * 100, 100)}%` }]}
              />
            </View>
          </View>
        </Animated.View>

        {/* Quick actions */}
        <Animated.View entering={FadeInDown.delay(600)}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <ActionCard icon="add-circle-outline" label="Create Post" color={Colors.primary} onPress={() => router.push('/(tabs)/create')} colors={colors} />
            <ActionCard icon="videocam-outline" label="Go Live" color={Colors.coral} onPress={() => {}} colors={colors} />
            <ActionCard icon="megaphone-outline" label="Promote" color={Colors.accent} onPress={() => {}} colors={colors} />
          </View>
        </Animated.View>

        {/* Account overview */}
        <Animated.View entering={FadeInDown.delay(700)}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
          <View style={[styles.infoCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <InfoRow label="Username" value={`@${user?.username || ''}`} colors={colors} />
            <InfoRow label="Account Type" value="Creator" colors={colors} />
            <InfoRow label="Posts" value={compactNumber(user?.postsCount || 0)} colors={colors} />
            <InfoRow label="Following" value={compactNumber(user?.followingCount || 0)} colors={colors} isLast />
          </View>
        </Animated.View>
      </ScrollView>
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
  growthBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,184,148,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  growthText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm, color: Colors.emerald },
  barContainer: { marginTop: Spacing.sm },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  sectionTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md, marginBottom: Spacing.md },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  actionCard: { flex: 1, borderRadius: Radii.lg, padding: Spacing.base, alignItems: 'center', gap: Spacing.sm, borderWidth: 1 },
  actionIconBg: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.xs, textAlign: 'center' },
  infoCard: { borderRadius: Radii.lg, borderWidth: 1, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  infoLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm },
  infoValue: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
});
