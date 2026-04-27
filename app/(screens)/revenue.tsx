import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../../src/theme/tokens';
import revenueApi, { type RevenueSummary, type DailyRevenueRow, type PayoutRequest } from '../../src/api/revenue.api';
import { compactNumber } from '../../src/utils/formatters';

const BAR_MAX_HEIGHT = 120;
const WINDOW_DAYS = 30;

type SourceTab = 'all' | 'ad_impression' | 'membership' | 'collaboration';
const SOURCE_TABS: { key: SourceTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ad_impression', label: 'Ads' },
  { key: 'membership', label: 'Members' },
  { key: 'collaboration', label: 'Collabs' },
];

interface DailyBar {
  dateLabel: string;
  amount: number;
}

const formatCurrency = (amount: number): string => `$${compactNumber(Math.max(0, amount))}`;

export default function RevenueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [daily, setDaily] = useState<DailyRevenueRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [sourceTab, setSourceTab] = useState<SourceTab>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [s, d, p] = await Promise.all([
        revenueApi.getSummary(),
        revenueApi.getDaily(WINDOW_DAYS),
        revenueApi.getPayoutHistory(),
      ]);
      setSummary(s);
      setDaily(d);
      setPayouts(p);
      setError(null);
    } catch {
      setError('Revenue data is unavailable right now.');
    }
  }, []);

  useEffect(() => {
    fetchAll().finally(() => setIsLoading(false));
  }, [fetchAll]);

  const dailyBars = useMemo((): DailyBar[] => {
    const bars = daily.map((r) => ({
      dateLabel: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount: Number(r.earnings ?? 0),
    }));
    return bars.slice(Math.max(0, bars.length - 12));
  }, [daily]);

  const filteredBreakdown = useMemo(() => {
    if (!summary) return [];
    if (sourceTab === 'all') return summary.breakdown;
    return summary.breakdown.filter((b) => b.source === sourceTab);
  }, [summary, sourceTab]);

  const maxBar = Math.max(...dailyBars.map((b) => b.amount), 0);

  if (isLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Revenue</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Revenue</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/(screens)/payout-settings')} hitSlop={8}>
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.delay(50)}>
          <LinearGradient colors={['#00B894', '#55EFC4']} style={styles.earningsCard}>
            <Text style={styles.earningsLabel}>Total Earnings</Text>
            <Text style={styles.earningsValue}>{formatCurrency(summary?.total ?? 0)}</Text>
            <View style={styles.earningsRow}>
              <View style={styles.earningsItem}>
                <Text style={styles.earningsItemLabel}>This Month</Text>
                <Text style={styles.earningsItemValue}>{formatCurrency(summary?.thisMonth ?? 0)}</Text>
              </View>
              <View style={styles.earningsDivider} />
              <View style={styles.earningsItem}>
                <Text style={styles.earningsItemLabel}>Last Month</Text>
                <Text style={styles.earningsItemValue}>{formatCurrency(summary?.lastMonth ?? 0)}</Text>
              </View>
              <View style={styles.earningsDivider} />
              <View style={styles.earningsItem}>
                <Text style={styles.earningsItemLabel}>Available</Text>
                <Text style={styles.earningsItemValue}>{formatCurrency(summary?.available ?? 0)}</Text>
              </View>
            </View>
            {/* Withdraw button */}
            <Pressable
              style={styles.withdrawBtn}
              onPress={() => router.push('/(screens)/payout-request')}
            >
              <Ionicons name="cash-outline" size={16} color="#00B894" />
              <Text style={styles.withdrawBtnText}>Withdraw Funds</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150)}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Earnings · Last {WINDOW_DAYS} days</Text>
          <View style={[styles.chartCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            {error ? (
              <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
            ) : dailyBars.length === 0 ? (
              <Text style={[styles.errorText, { color: colors.textTertiary }]}>
                No earnings tracked in this window.
              </Text>
            ) : (
              <View style={styles.chartBars}>
                {dailyBars.map((m, i) => {
                  const height = maxBar > 0 ? (m.amount / maxBar) * BAR_MAX_HEIGHT : 0;
                  return (
                    <View key={`${m.dateLabel}-${i}`} style={styles.barWrapper}>
                      <Text style={[styles.barAmount, { color: colors.textSecondary }]}>${compactNumber(m.amount)}</Text>
                      <LinearGradient
                        colors={[...Colors.gradientPrimary]}
                        style={[styles.bar, { height }]}
                      />
                      <Text style={[styles.barLabel, { color: colors.textTertiary }]} numberOfLines={1}>{m.dateLabel}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250)}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Revenue Breakdown</Text>
          {/* Source filter tabs */}
          <View style={styles.tabRow}>
            {SOURCE_TABS.map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => setSourceTab(tab.key)}
                style={[
                  styles.tab,
                  {
                    backgroundColor: sourceTab === tab.key ? Colors.primary : colors.surfaceElevated,
                    borderColor: sourceTab === tab.key ? Colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.tabLabel, { color: sourceTab === tab.key ? '#fff' : colors.textSecondary }]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.breakdownCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            {filteredBreakdown.length === 0 ? (
              <Text style={[styles.errorText, { color: colors.textTertiary }]}>
                {error ?? 'No revenue recorded yet.'}
              </Text>
            ) : (
              filteredBreakdown.map((item, index) => (
                <View
                  key={item.source}
                  style={[styles.breakdownItem, index < filteredBreakdown.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 0.5 }]}
                >
                  <View style={styles.breakdownLeft}>
                    <Text style={[styles.breakdownSource, { color: colors.text }]}>{item.source}</Text>
                    <Text style={[styles.breakdownPercentage, { color: colors.textTertiary }]}>{item.percentage}%</Text>
                  </View>
                  <Text style={[styles.breakdownAmount, { color: colors.text }]}>{formatCurrency(item.amount)}</Text>
                </View>
              ))
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350)}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Payout History</Text>
          {payouts.length === 0 ? (
            <View style={[styles.transactionCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[styles.errorText, { color: colors.textTertiary }]}>
                {error ?? 'No payouts yet.'}
              </Text>
            </View>
          ) : payouts.map((tx, index) => {
            const statusColor =
              tx.status === 'completed' ? '#00B894' :
              tx.status === 'failed' ? '#E17264' : '#FDCB6E';
            const statusIcon =
              tx.status === 'completed' ? 'checkmark-circle' :
              tx.status === 'failed' ? 'close-circle' : 'time';
            return (
              <Animated.View
                key={tx.id ?? String(index)}
                entering={FadeInDown.delay(400 + index * 40)}
                style={[styles.transactionCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              >
                <View style={[styles.txIcon, { backgroundColor: statusColor + '20' }]}>
                  <Ionicons name={statusIcon} size={20} color={statusColor} />
                </View>
                <View style={styles.txContent}>
                  <Text style={[styles.txDescription, { color: colors.text }]} numberOfLines={1}>
                    {tx.method === 'bank_transfer' ? 'Bank Transfer' : tx.method === 'paypal' ? 'PayPal' : 'Wallet'}
                  </Text>
                  <Text style={[styles.txDate, { color: colors.textTertiary }]}>
                    {new Date(tx.requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                <View style={styles.txRight}>
                  <Text style={[styles.txAmount, { color: statusColor }]}>
                    -{formatCurrency(tx.amount)}
                  </Text>
                  <Text style={[styles.txStatus, { color: colors.textTertiary }]}>{tx.status}</Text>
                </View>
              </Animated.View>
            );
          })}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, borderBottomWidth: 0.5 },
  headerTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.lg },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  withdrawBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: '#fff', borderRadius: Radii.full, paddingVertical: Spacing.sm, marginTop: Spacing.md },
  withdrawBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm, color: '#00B894' },
  tabRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  tab: { borderRadius: Radii.full, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  tabLabel: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.xs },
  content: { padding: Spacing.base, paddingBottom: 40 },
  earningsCard: { borderRadius: Radii.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  earningsLabel: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm, color: 'rgba(255,255,255,0.7)' },
  earningsValue: { fontFamily: Typography.fontFamily.bold, fontSize: 36, color: Colors.white, marginVertical: Spacing.sm },
  earningsRow: { flexDirection: 'row', alignItems: 'center' },
  earningsItem: { flex: 1, alignItems: 'center' },
  earningsItemLabel: { fontFamily: Typography.fontFamily.regular, fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  earningsItemValue: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base, color: Colors.white, marginTop: 2 },
  earningsDivider: { width: 0.5, height: 30, backgroundColor: 'rgba(255,255,255,0.3)' },
  sectionTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base, marginBottom: Spacing.sm },
  chartCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.base, marginBottom: Spacing.lg, minHeight: BAR_MAX_HEIGHT + 70 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: BAR_MAX_HEIGHT + 50 },
  barWrapper: { alignItems: 'center', gap: 6, minWidth: 32 },
  barAmount: { fontFamily: Typography.fontFamily.semiBold, fontSize: 10 },
  bar: { width: 18, borderRadius: 4 },
  barLabel: { fontFamily: Typography.fontFamily.medium, fontSize: 10 },
  breakdownCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.base, marginBottom: Spacing.lg },
  breakdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm },
  breakdownLeft: { flex: 1 },
  breakdownSource: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm },
  breakdownPercentage: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, marginTop: 2 },
  breakdownAmount: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base },
  transactionCard: { flexDirection: 'row', alignItems: 'center', borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txContent: { flex: 1, marginLeft: Spacing.sm },
  txDescription: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm },
  txDate: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, marginTop: 2 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.base },
  txStatus: { fontFamily: Typography.fontFamily.regular, fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  errorText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, textAlign: 'center', paddingVertical: Spacing.md },
});
