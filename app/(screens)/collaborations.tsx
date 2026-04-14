import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../../src/theme/tokens';
import { DUMMY_COLLABORATIONS } from '../../src/data/dummyData';
import { compactNumber } from '../../src/utils/formatters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type FilterStatus = 'all' | 'active' | 'pending' | 'completed' | 'declined';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: '#00B89420', text: '#00B894' },
  pending: { bg: '#FDCB6E20', text: '#FDCB6E' },
  completed: { bg: '#6C5CE720', text: '#6C5CE7' },
  declined: { bg: '#E1726420', text: '#E17264' },
};

export default function CollaborationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<FilterStatus>('all');

  const filtered = filter === 'all'
    ? DUMMY_COLLABORATIONS
    : DUMMY_COLLABORATIONS.filter((c) => c.status === filter);

  const totalEarnings = DUMMY_COLLABORATIONS
    .filter((c) => c.status === 'completed' || c.status === 'active')
    .reduce((sum, c) => sum + c.budget, 0);

  const renderCollaboration = useCallback(({ item, index }: { item: typeof DUMMY_COLLABORATIONS[0]; index: number }) => {
    const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.pending;
    const progress = item.totalDeliverables > 0 ? item.completedDeliverables / item.totalDeliverables : 0;

    return (
      <Animated.View entering={FadeInDown.delay(index * 80).duration(400)}>
        <Pressable style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <Image source={{ uri: item.brand.logo }} style={styles.brandLogo} contentFit="cover" />
            <View style={styles.cardHeaderText}>
              <View style={styles.brandRow}>
                <Text style={[styles.brandName, { color: colors.text }]}>{item.brand.name}</Text>
                {item.brand.isVerified && <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />}
              </View>
              <Text style={[styles.collabTitle, { color: colors.textSecondary }]} numberOfLines={1}>{item.title}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>{item.status}</Text>
            </View>
          </View>

          {/* Description */}
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>{item.description}</Text>

          {/* Deliverables */}
          <View style={styles.deliverablesRow}>
            {item.deliverables.map((d, i) => (
              <View key={i} style={[styles.deliverableTag, { backgroundColor: colors.surface }]}>
                <Text style={[styles.deliverableText, { color: colors.textSecondary }]}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Progress bar */}
          {(item.status === 'active' || item.status === 'completed') && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, { color: colors.textTertiary }]}>
                  {item.completedDeliverables}/{item.totalDeliverables} deliverables
                </Text>
                <Text style={[styles.progressPercent, { color: Colors.primary }]}>{Math.round(progress * 100)}%</Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <LinearGradient
                  colors={[...Colors.gradientPrimary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${progress * 100}%` }]}
                />
              </View>
            </View>
          )}

          {/* Footer */}
          <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
            <View style={styles.budgetSection}>
              <Text style={[styles.budgetLabel, { color: colors.textTertiary }]}>Budget</Text>
              <Text style={[styles.budgetValue, { color: colors.text }]}>${compactNumber(item.budget)}</Text>
            </View>
            <View style={styles.deadlineSection}>
              <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
              <Text style={[styles.deadlineText, { color: colors.textTertiary }]}>
                {new Date(item.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  }, [colors]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Collaborations</Text>
        <Pressable hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
        </Pressable>
      </View>

      {/* Summary card */}
      <Animated.View entering={FadeInDown.delay(50)}>
        <LinearGradient colors={[...Colors.gradientPrimary]} style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>Total Earnings</Text>
            <Text style={styles.summaryValue}>${compactNumber(totalEarnings)}</Text>
          </View>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStatItem}>
              <Text style={styles.summaryStatValue}>{DUMMY_COLLABORATIONS.filter((c) => c.status === 'active').length}</Text>
              <Text style={styles.summaryStatLabel}>Active</Text>
            </View>
            <View style={styles.summaryStatItem}>
              <Text style={styles.summaryStatValue}>{DUMMY_COLLABORATIONS.filter((c) => c.status === 'pending').length}</Text>
              <Text style={styles.summaryStatLabel}>Pending</Text>
            </View>
            <View style={styles.summaryStatItem}>
              <Text style={styles.summaryStatValue}>{DUMMY_COLLABORATIONS.filter((c) => c.status === 'completed').length}</Text>
              <Text style={styles.summaryStatLabel}>Done</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all', 'active', 'pending', 'completed'] as FilterStatus[]).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterTab, filter === f && { backgroundColor: Colors.primary + '20' }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, { color: filter === f ? Colors.primary : colors.textTertiary }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        renderItem={renderCollaboration}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No collaborations</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Brand partnerships will appear here</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, borderBottomWidth: 0.5 },
  headerTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.lg },
  summaryCard: { marginHorizontal: Spacing.base, marginTop: Spacing.md, borderRadius: Radii.lg, padding: Spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm, color: 'rgba(255,255,255,0.7)' },
  summaryValue: { fontFamily: Typography.fontFamily.bold, fontSize: 28, color: Colors.white, marginTop: 4 },
  summaryStats: { flexDirection: 'row', gap: Spacing.lg },
  summaryStatItem: { alignItems: 'center' },
  summaryStatValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.lg, color: Colors.white },
  summaryStatLabel: { fontFamily: Typography.fontFamily.regular, fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, gap: Spacing.sm },
  filterTab: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radii.full },
  filterText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  list: { paddingHorizontal: Spacing.base, paddingBottom: 40 },
  card: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.base, marginBottom: Spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  brandLogo: { width: 40, height: 40, borderRadius: 20 },
  cardHeaderText: { flex: 1, marginLeft: Spacing.sm },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  brandName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  collabTitle: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, marginTop: 2 },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radii.full },
  statusText: { fontFamily: Typography.fontFamily.semiBold, fontSize: 11, textTransform: 'capitalize' },
  description: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, lineHeight: 20, marginBottom: Spacing.sm },
  deliverablesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.sm },
  deliverableTag: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radii.sm },
  deliverableText: { fontFamily: Typography.fontFamily.regular, fontSize: 11 },
  progressSection: { marginBottom: Spacing.sm },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },
  progressPercent: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.xs },
  progressTrack: { height: 4, borderRadius: 2 },
  progressFill: { height: 4, borderRadius: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 0.5, paddingTop: Spacing.sm },
  budgetSection: {},
  budgetLabel: { fontFamily: Typography.fontFamily.regular, fontSize: 11 },
  budgetValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.base },
  deadlineSection: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deadlineText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.lg },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm },
});
