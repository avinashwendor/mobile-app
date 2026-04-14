import React from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../../src/theme/tokens';
import { DUMMY_REVENUE } from '../../src/data/dummyData';
import { compactNumber } from '../../src/utils/formatters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_MAX_HEIGHT = 120;

const STATUS_COLORS: Record<string, string> = {
  completed: '#00B894',
  pending: '#FDCB6E',
};

export default function RevenueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const maxMonth = Math.max(...DUMMY_REVENUE.monthlyData.map((m) => m.amount));

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
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
        {/* Total earnings */}
        <Animated.View entering={FadeInDown.delay(50)}>
          <LinearGradient colors={['#00B894', '#55EFC4']} style={styles.earningsCard}>
            <Text style={styles.earningsLabel}>Total Earnings</Text>
            <Text style={styles.earningsValue}>${compactNumber(DUMMY_REVENUE.totalEarnings)}</Text>
            <View style={styles.earningsRow}>
              <View style={styles.earningsItem}>
                <Text style={styles.earningsItemLabel}>This Month</Text>
                <Text style={styles.earningsItemValue}>${compactNumber(DUMMY_REVENUE.thisMonth)}</Text>
              </View>
              <View style={styles.earningsDivider} />
              <View style={styles.earningsItem}>
                <Text style={styles.earningsItemLabel}>Last Month</Text>
                <Text style={styles.earningsItemValue}>${compactNumber(DUMMY_REVENUE.lastMonth)}</Text>
              </View>
              <View style={styles.earningsDivider} />
              <View style={styles.earningsItem}>
                <Text style={styles.earningsItemLabel}>Pending</Text>
                <Text style={styles.earningsItemValue}>${compactNumber(DUMMY_REVENUE.pending)}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Monthly chart */}
        <Animated.View entering={FadeInDown.delay(150)}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Monthly Earnings</Text>
          <View style={[styles.chartCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <View style={styles.chartBars}>
              {DUMMY_REVENUE.monthlyData.map((m, i) => {
                const height = maxMonth > 0 ? (m.amount / maxMonth) * BAR_MAX_HEIGHT : 0;
                return (
                  <View key={m.month} style={styles.barWrapper}>
                    <Text style={[styles.barAmount, { color: colors.textSecondary }]}>${compactNumber(m.amount)}</Text>
                    <LinearGradient
                      colors={[...Colors.gradientPrimary]}
                      style={[styles.bar, { height }]}
                    />
                    <Text style={[styles.barLabel, { color: colors.textTertiary }]}>{m.month}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </Animated.View>

        {/* Revenue breakdown */}
        <Animated.View entering={FadeInDown.delay(250)}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Revenue Breakdown</Text>
          <View style={[styles.breakdownCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            {DUMMY_REVENUE.breakdown.map((item, index) => (
              <View
                key={item.source}
                style={[styles.breakdownItem, index < DUMMY_REVENUE.breakdown.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 0.5 }]}
              >
                <View style={styles.breakdownLeft}>
                  <Text style={[styles.breakdownSource, { color: colors.text }]}>{item.source}</Text>
                  <Text style={[styles.breakdownPercentage, { color: colors.textTertiary }]}>{item.percentage}%</Text>
                </View>
                <Text style={[styles.breakdownAmount, { color: colors.text }]}>${compactNumber(item.amount)}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Recent transactions */}
        <Animated.View entering={FadeInDown.delay(350)}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Transactions</Text>
          {DUMMY_REVENUE.recentTransactions.map((tx, index) => (
            <Animated.View
              key={tx._id}
              entering={FadeInDown.delay(400 + index * 60)}
              style={[styles.transactionCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            >
              <View style={[styles.txIcon, { backgroundColor: tx.status === 'completed' ? '#00B89420' : '#FDCB6E20' }]}>
                <Ionicons
                  name={tx.status === 'completed' ? 'checkmark-circle' : 'time'}
                  size={20}
                  color={STATUS_COLORS[tx.status]}
                />
              </View>
              <View style={styles.txContent}>
                <Text style={[styles.txDescription, { color: colors.text }]} numberOfLines={1}>{tx.description}</Text>
                <Text style={[styles.txDate, { color: colors.textTertiary }]}>
                  {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
              <View style={styles.txRight}>
                <Text style={[styles.txAmount, { color: tx.status === 'completed' ? '#00B894' : '#FDCB6E' }]}>
                  +${compactNumber(tx.amount)}
                </Text>
                <Text style={[styles.txStatus, { color: colors.textTertiary }]}>{tx.status}</Text>
              </View>
            </Animated.View>
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
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
  chartCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.base, marginBottom: Spacing.lg },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: BAR_MAX_HEIGHT + 50 },
  barWrapper: { alignItems: 'center', gap: 6 },
  barAmount: { fontFamily: Typography.fontFamily.semiBold, fontSize: 10 },
  bar: { width: 36, borderRadius: 6 },
  barLabel: { fontFamily: Typography.fontFamily.medium, fontSize: 12 },
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
});
