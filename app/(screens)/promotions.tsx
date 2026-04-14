import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../../src/theme/tokens';
import { DUMMY_ADS } from '../../src/data/dummyData';
import { compactNumber } from '../../src/utils/formatters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type AdStatus = 'active' | 'completed' | 'paused';
type FilterTab = 'all' | AdStatus;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
  { key: 'completed', label: 'Completed' },
];

const STATUS_CONFIG: Record<AdStatus, { color: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  active: { color: '#00B894', label: 'Active', icon: 'radio-button-on' },
  paused: { color: '#FDCB6E', label: 'Paused', icon: 'pause-circle' },
  completed: { color: Colors.primary, label: 'Completed', icon: 'checkmark-circle' },
};

export default function PromotionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<FilterTab>('all');

  const filteredAds = filter === 'all'
    ? DUMMY_ADS
    : DUMMY_ADS.filter((ad) => ad.status === filter);

  const totalSpent = DUMMY_ADS.reduce((s, a) => s + a.spent, 0);
  const totalReach = DUMMY_ADS.reduce((s, a) => s + a.reach, 0);
  const activeCount = DUMMY_ADS.filter((a) => a.status === 'active').length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Promotions</Text>
        <Pressable hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Summary */}
        <Animated.View entering={FadeInDown.delay(50)}>
          <LinearGradient colors={[...Colors.gradientPrimary]} style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Spent</Text>
                <Text style={styles.summaryValue}>${totalSpent.toFixed(0)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Reach</Text>
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

        {/* Filter tabs */}
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

        {/* Ad cards */}
        {filteredAds.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="megaphone-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No promotions in this category</Text>
          </View>
        ) : (
          filteredAds.map((ad, index) => {
            const cfg = STATUS_CONFIG[ad.status];
            const budgetProgress = ad.budget > 0 ? ad.spent / ad.budget : 0;
            return (
              <Animated.View
                key={ad._id}
                entering={FadeInDown.delay(150 + index * 80)}
                style={[styles.adCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              >
                {/* Post preview + status */}
                <View style={styles.adTop}>
                  <Image source={{ uri: ad.postImage }} style={styles.adImage} contentFit="cover" />
                  <View style={styles.adInfo}>
                    <Text style={[styles.adCaption, { color: colors.text }]} numberOfLines={2}>{ad.caption}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: cfg.color + '20' }]}>
                      <Ionicons name={cfg.icon} size={12} color={cfg.color} />
                      <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                </View>

                {/* Budget progress */}
                <View style={styles.budgetSection}>
                  <View style={styles.budgetHeader}>
                    <Text style={[styles.budgetLabel, { color: colors.textSecondary }]}>Budget</Text>
                    <Text style={[styles.budgetValue, { color: colors.text }]}>
                      ${ad.spent.toFixed(0)} / ${ad.budget}
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

                {/* Metrics grid */}
                <View style={styles.metricsGrid}>
                  <MetricItem label="Reach" value={compactNumber(ad.reach)} colors={colors} />
                  <MetricItem label="Impressions" value={compactNumber(ad.impressions)} colors={colors} />
                  <MetricItem label="Clicks" value={compactNumber(ad.clicks)} colors={colors} />
                  <MetricItem label="Engagement" value={`${(ad.engagement * 100).toFixed(1)}%`} colors={colors} />
                </View>

                {/* Actions */}
                <View style={styles.adActions}>
                  {ad.status === 'active' && (
                    <Pressable style={[styles.actionBtn, { backgroundColor: '#FDCB6E20', borderColor: '#FDCB6E' }]}>
                      <Ionicons name="pause" size={14} color="#FDCB6E" />
                      <Text style={[styles.actionLabel, { color: '#FDCB6E' }]}>Pause</Text>
                    </Pressable>
                  )}
                  {ad.status === 'paused' && (
                    <Pressable style={[styles.actionBtn, { backgroundColor: '#00B89420', borderColor: '#00B894' }]}>
                      <Ionicons name="play" size={14} color="#00B894" />
                      <Text style={[styles.actionLabel, { color: '#00B894' }]}>Resume</Text>
                    </Pressable>
                  )}
                  <Pressable style={[styles.actionBtn, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Ionicons name="bar-chart-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>Insights</Text>
                  </Pressable>
                  {ad.status !== 'completed' && (
                    <Pressable style={[styles.actionBtn, { backgroundColor: '#FF767620', borderColor: '#FF7676' }]}>
                      <Ionicons name="close" size={14} color="#FF7676" />
                      <Text style={[styles.actionLabel, { color: '#FF7676' }]}>End</Text>
                    </Pressable>
                  )}
                </View>
              </Animated.View>
            );
          })
        )}

        {/* Promote CTA */}
        <Animated.View entering={FadeInDown.delay(500)}>
          <Pressable style={styles.promoteCTA}>
            <LinearGradient colors={[...Colors.gradientPrimary]} style={styles.promoteGradient}>
              <Ionicons name="megaphone" size={20} color={Colors.white} />
              <Text style={styles.promoteText}>Promote a Post</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </ScrollView>
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
  emptyText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm },
  adCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.base, marginBottom: Spacing.md },
  adTop: { flexDirection: 'row', marginBottom: Spacing.md },
  adImage: { width: 72, height: 72, borderRadius: Radii.md },
  adInfo: { flex: 1, marginLeft: Spacing.sm, justifyContent: 'center' },
  adCaption: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm, lineHeight: 18 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.full, marginTop: Spacing.xs },
  statusLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: 11 },
  budgetSection: { marginBottom: Spacing.md },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  budgetLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },
  budgetValue: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  daysLeft: { fontFamily: Typography.fontFamily.regular, fontSize: 11, marginTop: 4 },
  metricsGrid: { flexDirection: 'row', marginBottom: Spacing.md },
  metricItem: { flex: 1, alignItems: 'center' },
  metricValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.base },
  metricLabel: { fontFamily: Typography.fontFamily.regular, fontSize: 11, marginTop: 2 },
  adActions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radii.full, borderWidth: 1 },
  actionLabel: { fontFamily: Typography.fontFamily.medium, fontSize: 12 },
  promoteCTA: { marginTop: Spacing.sm },
  promoteGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radii.lg },
  promoteText: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.base, color: Colors.white },
});
