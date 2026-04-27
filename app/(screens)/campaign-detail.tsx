import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../../src/theme/tokens';
import adApi, { type CampaignStats, type AdStatus } from '../../src/api/ad.api';
import { compactNumber } from '../../src/utils/formatters';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AdStatus, { color: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  draft: { color: '#A0A0B4', label: 'Draft', icon: 'create-outline' },
  pending_review: { color: '#FDCB6E', label: 'In Review', icon: 'hourglass-outline' },
  active: { color: '#00B894', label: 'Active', icon: 'radio-button-on' },
  paused: { color: '#FDCB6E', label: 'Paused', icon: 'pause-circle' },
  completed: { color: Colors.primary, label: 'Completed', icon: 'checkmark-circle' },
  rejected: { color: '#E17264', label: 'Rejected', icon: 'close-circle' },
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CampaignDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const { campaignId } = useLocalSearchParams<{ campaignId: string }>();

  const [statsData, setStatsData] = useState<CampaignStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!campaignId) return;
    try {
      const data = await adApi.getCampaignStats(campaignId);
      setStatsData(data);
      setError(null);
    } catch {
      setError('Could not load campaign details. Try again later.');
    }
  }, [campaignId]);

  useEffect(() => {
    fetch().finally(() => setIsLoading(false));
  }, [fetch]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetch();
    setIsRefreshing(false);
  }, [fetch]);

  const handleToggle = useCallback(async () => {
    if (!statsData) return;
    const current = statsData.campaign.status;
    if (current !== 'active' && current !== 'paused') return;
    const newStatus = current === 'active' ? 'paused' : 'active';
    setIsToggling(true);
    try {
      await adApi.updateStatus(campaignId!, newStatus);
      await fetch();
    } catch {
      Alert.alert('Error', 'Could not update campaign status. Try again.');
    } finally {
      setIsToggling(false);
    }
  }, [statsData, campaignId, fetch]);

  if (isLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  const campaign = statsData?.campaign;
  const stats = statsData?.stats;
  const adSets = statsData?.adSets ?? [];

  const statusCfg = campaign ? STATUS_CONFIG[campaign.status] : null;
  const canToggle = campaign?.status === 'active' || campaign?.status === 'paused';
  const budgetProgress =
    campaign && Number(campaign.budget.total) > 0
      ? Math.min(Number(stats?.spend ?? 0) / Number(campaign.budget.total), 1)
      : 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {campaign?.name ?? 'Campaign'}
        </Text>
        {canToggle ? (
          <Pressable onPress={handleToggle} disabled={isToggling} hitSlop={8}>
            {isToggling ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons
                name={campaign?.status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'}
                size={26}
                color={Colors.primary}
              />
            )}
          </Pressable>
        ) : (
          <View style={{ width: 26 }} />
        )}
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
          {/* Status + budget */}
          {campaign && statusCfg && (
            <Animated.View entering={FadeInDown.delay(100)}>
              <LinearGradient
                colors={[...Colors.gradientPrimary]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.heroRow}>
                  <View>
                    <Text style={styles.heroLabel}>Campaign Status</Text>
                    <View style={styles.statusRow}>
                      <Ionicons name={statusCfg.icon} size={16} color="#fff" />
                      <Text style={styles.heroValue}>{statusCfg.label}</Text>
                    </View>
                  </View>
                  <View style={styles.heroDivider} />
                  <View>
                    <Text style={styles.heroLabel}>Budget</Text>
                    <Text style={styles.heroValue}>${Number(campaign.budget.total).toFixed(0)}</Text>
                  </View>
                </View>
                <View style={styles.budgetBarTrack}>
                  <View style={[styles.budgetBarFill, { width: `${budgetProgress * 100}%` }]} />
                </View>
                <Text style={styles.heroSub}>
                  ${Number(stats?.spend ?? 0).toFixed(2)} spent of ${Number(campaign.budget.total).toFixed(2)}
                </Text>
              </LinearGradient>
            </Animated.View>
          )}

          {/* Stats grid */}
          <Animated.View entering={FadeInDown.delay(200)}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Performance</Text>
            <View style={styles.metricsGrid}>
              <StatCard label="Impressions" value={compactNumber(stats?.impressions ?? 0)} icon="eye-outline" color={Colors.primary} colors={colors} />
              <StatCard label="Clicks" value={compactNumber(stats?.clicks ?? 0)} icon="hand-left-outline" color={Colors.accent} colors={colors} />
              <StatCard label="CTR" value={`${((stats?.ctr ?? 0) * 100).toFixed(1)}%`} icon="trending-up-outline" color={Colors.emerald} colors={colors} />
              <StatCard label="Spend" value={`$${(stats?.spend ?? 0).toFixed(2)}`} icon="cash-outline" color={Colors.amber} colors={colors} />
            </View>
          </Animated.View>

          {/* Ad sets */}
          {adSets.length > 0 && (
            <Animated.View entering={FadeInDown.delay(300)}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Ad Sets ({adSets.length})</Text>
              {adSets.map((adSet, idx) => (
                <Animated.View
                  key={adSet.id}
                  entering={FadeInDown.delay(350 + idx * 60)}
                  style={[styles.adSetCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                >
                  <View style={styles.adSetHeader}>
                    <Text style={[styles.adSetName, { color: colors.text }]} numberOfLines={1}>{adSet.name}</Text>
                    <View style={[styles.adSetBadge, { backgroundColor: adSet.status === 'active' ? Colors.emerald + '20' : colors.border }]}>
                      <Text style={[styles.adSetBadgeText, { color: adSet.status === 'active' ? Colors.emerald : colors.textTertiary }]}>
                        {adSet.status}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.adSetMetrics}>
                    <AdSetMetric label="Impressions" value={compactNumber(adSet.metrics.impressions)} colors={colors} />
                    <AdSetMetric label="Clicks" value={compactNumber(adSet.metrics.clicks)} colors={colors} />
                    <AdSetMetric label="Spend" value={`$${adSet.metrics.spend.toFixed(2)}`} colors={colors} />
                  </View>
                </Animated.View>
              ))}
            </Animated.View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, colors }: {
  label: string; value: string; icon: keyof typeof Ionicons.glyphMap; color: string; colors: any;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <View style={[styles.statIconBg, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

function AdSetMetric({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.adSetMetric}>
      <Text style={[styles.adSetMetricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.adSetMetricLabel, { color: colors.textTertiary }]}>{label}</Text>
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
  headerTitle: { flex: 1, fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.lg, textAlign: 'center', marginHorizontal: Spacing.sm },
  errorText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, textAlign: 'center', paddingHorizontal: Spacing.xl },
  scroll: { flex: 1 },
  content: { padding: Spacing.base },
  heroCard: { borderRadius: Radii.xl, padding: Spacing.xl, marginBottom: Spacing.xl },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: Spacing.md },
  heroLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  heroValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.xl, color: '#fff' },
  heroDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  budgetBarTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden', marginBottom: Spacing.xs },
  budgetBarFill: { height: '100%', borderRadius: 3, backgroundColor: '#fff' },
  heroSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  sectionTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md, marginBottom: Spacing.md },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: { flex: 1, minWidth: '45%', borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.base, alignItems: 'center', gap: Spacing.xs },
  statIconBg: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.xl },
  statLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },
  adSetCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.base, marginBottom: Spacing.sm },
  adSetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  adSetName: { flex: 1, fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  adSetBadge: { borderRadius: Radii.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  adSetBadgeText: { fontFamily: Typography.fontFamily.medium, fontSize: 11, textTransform: 'capitalize' },
  adSetMetrics: { flexDirection: 'row', justifyContent: 'space-around' },
  adSetMetric: { alignItems: 'center' },
  adSetMetricValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.md },
  adSetMetricLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, marginTop: 2 },
});
