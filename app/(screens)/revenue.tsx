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
import apiClient from '../../src/api/client';
import { compactNumber } from '../../src/utils/formatters';

const BAR_MAX_HEIGHT = 120;
const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;

interface AnalyticsRow {
  date: string;
  ad_earnings?: number;
  reach?: number;
  impressions?: number;
}

interface EarningsRow {
  _id?: string;
  id?: string;
  content_type?: string;
  period?: string;
  earnings?: number;
  currency?: string;
  is_paid?: boolean;
  paid_at?: string;
  created_at?: string;
}

interface DailyBar {
  dateLabel: string;
  amount: number;
}

const formatCurrency = (amount: number): string => `$${compactNumber(Math.max(0, amount))}`;

const isoDaysAgo = (days: number): string => new Date(Date.now() - days * DAY_MS).toISOString();

const startOfMonth = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), 1);

export default function RevenueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([]);
  const [earnings, setEarnings] = useState<EarningsRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [earningsError, setEarningsError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      const { data } = await apiClient.get<{ success: boolean; data: AnalyticsRow[] }>('/analytics/me', {
        params: {
          start_date: isoDaysAgo(WINDOW_DAYS),
          end_date: new Date().toISOString(),
        },
      });
      setAnalytics(Array.isArray(data.data) ? data.data : []);
      setAnalyticsError(null);
    } catch {
      setAnalytics([]);
      setAnalyticsError('Earnings analytics are unavailable right now.');
    }
  }, []);

  const fetchEarnings = useCallback(async () => {
    try {
      const { data } = await apiClient.get<{ success: boolean; data: EarningsRow[] }>('/ads/earnings', {
        params: { limit: 20 },
      });
      setEarnings(Array.isArray(data.data) ? data.data : []);
      setEarningsError(null);
    } catch {
      setEarnings([]);
      setEarningsError('Transaction history is unavailable right now.');
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchAnalytics(), fetchEarnings()]).finally(() => setIsLoading(false));
  }, [fetchAnalytics, fetchEarnings]);

  const { analyticsEarnings, dailyBars } = useMemo(() => {
    let total = 0;
    const bars: DailyBar[] = [];
    for (const row of analytics) {
      const amount = Number(row.ad_earnings ?? 0);
      total += amount;
      bars.push({
        dateLabel: new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        amount,
      });
    }
    // Only render up to 12 bars so the chart stays legible.
    const trimmed = bars.slice(Math.max(0, bars.length - 12));
    return { analyticsEarnings: total, dailyBars: trimmed };
  }, [analytics]);

  const { totalPaid, thisMonth, lastMonth, pending, breakdown } = useMemo(() => {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const lastMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    let total = 0;
    let thisM = 0;
    let lastM = 0;
    let pend = 0;
    const sourceMap = new Map<string, number>();

    for (const row of earnings) {
      const amount = Number(row.earnings ?? 0);
      const createdAt = new Date(row.paid_at ?? row.created_at ?? 0);
      total += amount;
      if (!row.is_paid) pend += amount;

      if (createdAt >= thisMonthStart) thisM += amount;
      else if (createdAt >= lastMonthStart && createdAt < thisMonthStart) lastM += amount;

      const source = row.content_type
        ? `${row.content_type.charAt(0).toUpperCase()}${row.content_type.slice(1)} ads`
        : 'Ad revenue';
      sourceMap.set(source, (sourceMap.get(source) ?? 0) + amount);
    }

    const totalForPct = total || 1;
    const list = Array.from(sourceMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([source, amount]) => ({
        source,
        amount,
        percentage: Math.round((amount / totalForPct) * 100),
      }));

    return { totalPaid: total, thisMonth: thisM, lastMonth: lastM, pending: pend, breakdown: list };
  }, [earnings]);

  const topLineTotal = totalPaid > 0 ? totalPaid : analyticsEarnings;
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
        <Pressable hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="download-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.delay(50)}>
          <LinearGradient colors={['#00B894', '#55EFC4']} style={styles.earningsCard}>
            <Text style={styles.earningsLabel}>Total Earnings</Text>
            <Text style={styles.earningsValue}>{formatCurrency(topLineTotal)}</Text>
            <View style={styles.earningsRow}>
              <View style={styles.earningsItem}>
                <Text style={styles.earningsItemLabel}>This Month</Text>
                <Text style={styles.earningsItemValue}>{formatCurrency(thisMonth)}</Text>
              </View>
              <View style={styles.earningsDivider} />
              <View style={styles.earningsItem}>
                <Text style={styles.earningsItemLabel}>Last Month</Text>
                <Text style={styles.earningsItemValue}>{formatCurrency(lastMonth)}</Text>
              </View>
              <View style={styles.earningsDivider} />
              <View style={styles.earningsItem}>
                <Text style={styles.earningsItemLabel}>Pending</Text>
                <Text style={styles.earningsItemValue}>{formatCurrency(pending)}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150)}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Ad Earnings · Last {WINDOW_DAYS} days</Text>
          <View style={[styles.chartCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            {analyticsError ? (
              <Text style={[styles.errorText, { color: colors.textSecondary }]}>{analyticsError}</Text>
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
          <View style={[styles.breakdownCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            {breakdown.length === 0 ? (
              <Text style={[styles.errorText, { color: colors.textTertiary }]}>
                {earningsError ?? 'No revenue recorded yet.'}
              </Text>
            ) : (
              breakdown.map((item, index) => (
                <View
                  key={item.source}
                  style={[styles.breakdownItem, index < breakdown.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 0.5 }]}
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Transactions</Text>
          {earnings.length === 0 ? (
            <View style={[styles.transactionCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[styles.errorText, { color: colors.textTertiary }]}>
                {earningsError ?? 'No transactions yet.'}
              </Text>
            </View>
          ) : earnings.map((tx, index) => {
            const paid = Boolean(tx.is_paid);
            const date = tx.paid_at ?? tx.created_at ?? new Date().toISOString();
            const statusColor = paid ? '#00B894' : '#FDCB6E';
            const description = tx.content_type
              ? `${tx.content_type.charAt(0).toUpperCase()}${tx.content_type.slice(1)} earnings${tx.period ? ` · ${tx.period}` : ''}`
              : `Earnings${tx.period ? ` · ${tx.period}` : ''}`;
            return (
              <Animated.View
                key={String(tx._id ?? tx.id ?? index)}
                entering={FadeInDown.delay(400 + index * 40)}
                style={[styles.transactionCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              >
                <View style={[styles.txIcon, { backgroundColor: statusColor + '20' }]}>
                  <Ionicons
                    name={paid ? 'checkmark-circle' : 'time'}
                    size={20}
                    color={statusColor}
                  />
                </View>
                <View style={styles.txContent}>
                  <Text style={[styles.txDescription, { color: colors.text }]} numberOfLines={1}>{description}</Text>
                  <Text style={[styles.txDate, { color: colors.textTertiary }]}>
                    {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                <View style={styles.txRight}>
                  <Text style={[styles.txAmount, { color: statusColor }]}>
                    +{formatCurrency(Number(tx.earnings ?? 0))}
                  </Text>
                  <Text style={[styles.txStatus, { color: colors.textTertiary }]}>{paid ? 'paid' : 'pending'}</Text>
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
