import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../../src/theme/tokens';
import apiClient from '../../src/api/client';
import { compactNumber } from '../../src/utils/formatters';

type AdStatus = 'draft' | 'pending_review' | 'active' | 'paused' | 'completed' | 'rejected';
type FilterTab = 'all' | 'active' | 'paused' | 'completed';

interface RawCampaign {
  _id?: string;
  id?: string;
  name?: string;
  status?: AdStatus;
  budget?: { total?: number; daily_limit?: number };
  schedule?: { start_date?: string; end_date?: string };
  creative?: { media_url?: string; caption?: string };
  metrics?: { impressions?: number; clicks?: number; spend?: number };
}

interface Campaign {
  id: string;
  title: string;
  caption: string;
  status: AdStatus;
  budgetTotal: number;
  spent: number;
  impressions: number;
  clicks: number;
  reach: number;
  engagement: number;
  daysRemaining: number;
  postImage: string | null;
}

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
  { key: 'completed', label: 'Completed' },
];

const STATUS_CONFIG: Record<AdStatus, { color: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  draft: { color: '#A0A0B4', label: 'Draft', icon: 'create-outline' },
  pending_review: { color: '#FDCB6E', label: 'In Review', icon: 'hourglass-outline' },
  active: { color: '#00B894', label: 'Active', icon: 'radio-button-on' },
  paused: { color: '#FDCB6E', label: 'Paused', icon: 'pause-circle' },
  completed: { color: Colors.primary, label: 'Completed', icon: 'checkmark-circle' },
  rejected: { color: '#E17264', label: 'Rejected', icon: 'close-circle' },
};

const DAY_MS = 24 * 60 * 60 * 1000;

const mapCampaign = (raw: RawCampaign): Campaign => {
  const id = String(raw._id ?? raw.id ?? '');
  const impressions = Number(raw.metrics?.impressions ?? 0);
  const clicks = Number(raw.metrics?.clicks ?? 0);
  const spent = Number(raw.metrics?.spend ?? 0);
  const budgetTotal = Number(raw.budget?.total ?? 0);
  const end = raw.schedule?.end_date ? new Date(raw.schedule.end_date).getTime() : 0;
  const daysRemaining = end > 0 ? Math.max(0, Math.ceil((end - Date.now()) / DAY_MS)) : 0;
  return {
    id,
    title: raw.name ?? 'Untitled campaign',
    caption: raw.creative?.caption ?? '',
    status: (raw.status ?? 'draft') as AdStatus,
    budgetTotal,
    spent,
    impressions,
    clicks,
    // Reach isn't tracked per campaign yet; best approximation = impressions.
    reach: impressions,
    engagement: impressions > 0 ? clicks / impressions : 0,
    daysRemaining,
    postImage: raw.creative?.media_url ?? null,
  };
};

export default function PromotionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    try {
      const { data } = await apiClient.get<{ success: boolean; data: RawCampaign[] }>('/ads/campaigns');
      const list = Array.isArray(data.data) ? data.data : [];
      setCampaigns(list.map(mapCampaign));
      setError(null);
    } catch {
      setCampaigns([]);
      setError('Promotions are unavailable right now. Try again later.');
    }
  }, []);

  useEffect(() => {
    fetchCampaigns().finally(() => setIsLoading(false));
  }, [fetchCampaigns]);

  const filteredAds = useMemo(() => {
    if (filter === 'all') return campaigns;
    return campaigns.filter((c) => c.status === filter);
  }, [campaigns, filter]);

  const { totalSpent, totalReach, activeCount } = useMemo(() => ({
    totalSpent: campaigns.reduce((s, a) => s + a.spent, 0),
    totalReach: campaigns.reduce((s, a) => s + a.reach, 0),
    activeCount: campaigns.filter((a) => a.status === 'active').length,
  }), [campaigns]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Promotions</Text>
        <Pressable hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => router.push('/(screens)/create-campaign')}>
          <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Animated.View entering={FadeInDown.delay(50)}>
            <LinearGradient colors={[...Colors.gradientPrimary]} style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Spent</Text>
                  <Text style={styles.summaryValue}>${totalSpent.toFixed(0)}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Impressions</Text>
                  <Text style={styles.summaryValue}>{compactNumber(totalReach)}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Active</Text>
                  <Text style={styles.summaryValue}>{activeCount}</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {error ? (
            <View style={[styles.errorCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Ionicons name="alert-circle-outline" size={20} color="#E17264" />
              <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
            </View>
          ) : null}

          {campaigns.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(100)} style={styles.filterRow}>
              {FILTER_TABS.map((tab) => {
                const active = filter === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setFilter(tab.key)}
                    style={[
                      styles.filterTab,
                      {
                        backgroundColor: active ? Colors.primary : colors.surfaceElevated,
                        borderColor: active ? Colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.filterLabel, { color: active ? Colors.white : colors.textSecondary }]}>{tab.label}</Text>
                  </Pressable>
                );
              })}
            </Animated.View>
          ) : null}

          {campaigns.length === 0 && !error ? (
            <Animated.View entering={FadeInDown.delay(100)} style={[styles.emptyCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Ionicons name="megaphone-outline" size={40} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No campaigns yet</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Boost a post or reel to reach a larger audience with your first promotion.
              </Text>
              <Pressable style={styles.emptyCTA} onPress={() => router.push('/(screens)/create-campaign')}>
                <LinearGradient colors={[...Colors.gradientPrimary]} style={styles.emptyCTAGradient}>
                  <Ionicons name="add-circle-outline" size={18} color={Colors.white} />
                  <Text style={styles.emptyCTAText}>Create a campaign</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          ) : null}

          {filteredAds.length === 0 && campaigns.length > 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="megaphone-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No promotions in this category</Text>
            </View>
          ) : null}

          {filteredAds.map((ad, index) => {
            const cfg = STATUS_CONFIG[ad.status];
            const budgetProgress = ad.budgetTotal > 0 ? ad.spent / ad.budgetTotal : 0;
            return (
              <Animated.View
                key={ad.id}
                entering={FadeInDown.delay(150 + index * 80)}
              >
              <Pressable
                onPress={() => router.push({ pathname: '/(screens)/campaign-detail', params: { campaignId: ad.id } })}
                style={[styles.adCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              >
                <View style={styles.adTop}>
                  {ad.postImage ? (
                    <Image source={{ uri: ad.postImage }} style={styles.adImage} contentFit="cover" />
                  ) : (
                    <View style={[styles.adImage, styles.adImagePlaceholder, { backgroundColor: colors.surface }]}>
                      <Ionicons name="image-outline" size={24} color={colors.textTertiary} />
                    </View>
                  )}
                  <View style={styles.adInfo}>
                    <Text style={[styles.adCaption, { color: colors.text }]} numberOfLines={1}>{ad.title}</Text>
                    {ad.caption ? (
                      <Text style={[styles.adSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                        {ad.caption}
                      </Text>
                    ) : null}
                    <View style={[styles.statusBadge, { backgroundColor: cfg.color + '20' }]}>
                      <Ionicons name={cfg.icon} size={12} color={cfg.color} />
                      <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.budgetSection}>
                  <View style={styles.budgetHeader}>
                    <Text style={[styles.budgetLabel, { color: colors.textSecondary }]}>Budget</Text>
                    <Text style={[styles.budgetValue, { color: colors.text }]}>
                      ${ad.spent.toFixed(0)} / ${ad.budgetTotal.toFixed(0)}
                    </Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                    <LinearGradient
                      colors={[cfg.color, cfg.color + 'CC']}
                      style={[styles.progressFill, { width: `${Math.min(budgetProgress * 100, 100)}%` }]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    />
                  </View>
                  {ad.daysRemaining > 0 && (
                    <Text style={[styles.daysLeft, { color: colors.textTertiary }]}>{ad.daysRemaining} days remaining</Text>
                  )}
                </View>

                <View style={styles.metricsGrid}>
                  <MetricItem label="Impressions" value={compactNumber(ad.impressions)} colors={colors} />
                  <MetricItem label="Clicks" value={compactNumber(ad.clicks)} colors={colors} />
                  <MetricItem label="CTR" value={`${(ad.engagement * 100).toFixed(1)}%`} colors={colors} />
                </View>
              </Pressable>
              </Animated.View>
            );
          })}

          <Animated.View entering={FadeInDown.delay(500)}>
            <Pressable style={styles.promoteCTA} onPress={() => router.push('/(screens)/create-campaign')}>
              <LinearGradient colors={[...Colors.gradientPrimary]} style={styles.promoteGradient}>
                <Ionicons name="megaphone" size={20} color={Colors.white} />
                <Text style={styles.promoteText}>Promote a Post</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}

function MetricItem({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.metricItem}>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, borderBottomWidth: 0.5 },
  headerTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.lg },
  content: { padding: Spacing.base, paddingBottom: 40 },
  summaryCard: { borderRadius: Radii.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontFamily: Typography.fontFamily.regular, fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  summaryValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.xl, color: Colors.white, marginTop: 4 },
  summaryDivider: { width: 0.5, height: 36, backgroundColor: 'rgba(255,255,255,0.3)' },
  filterRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  filterTab: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radii.full, borderWidth: 1 },
  filterLabel: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm, textAlign: 'center' },
  emptyCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  emptyTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },
  emptyCTA: { marginTop: Spacing.sm, alignSelf: 'stretch' },
  emptyCTAGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderRadius: Radii.full },
  emptyCTAText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm, color: Colors.white },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radii.md, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.md },
  errorText: { flex: 1, fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm },
  adCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.base, marginBottom: Spacing.md },
  adTop: { flexDirection: 'row', marginBottom: Spacing.md },
  adImage: { width: 72, height: 72, borderRadius: Radii.md },
  adImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  adInfo: { flex: 1, marginLeft: Spacing.sm, justifyContent: 'center' },
  adCaption: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  adSubtitle: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, lineHeight: 16, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.full, marginTop: Spacing.xs },
  statusLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: 11 },
  budgetSection: { marginBottom: Spacing.md },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  budgetLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },
  budgetValue: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  daysLeft: { fontFamily: Typography.fontFamily.regular, fontSize: 11, marginTop: 4 },
  metricsGrid: { flexDirection: 'row' },
  metricItem: { flex: 1, alignItems: 'center' },
  metricValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.base },
  metricLabel: { fontFamily: Typography.fontFamily.regular, fontSize: 11, marginTop: 2 },
  promoteCTA: { marginTop: Spacing.sm },
  promoteGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radii.lg },
  promoteText: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.base, color: Colors.white },
});
