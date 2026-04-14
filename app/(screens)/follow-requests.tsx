import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, SlideOutRight } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../src/theme/tokens';
import UserAvatar from '../../src/components/UserAvatar';
import GradientButton from '../../src/components/GradientButton';
import * as followApi from '../../src/api/follow.api';
import { timeAgo } from '../../src/utils/formatters';
import type { FollowRequest } from '../../src/api/follow.api';

export default function FollowRequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const result = await followApi.getFollowRequests(1, 50);
        setRequests(result.requests);
      } catch (err) {
        console.error('Failed to load follow requests:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleAccept = useCallback(async (requestId: string) => {
    try {
      await followApi.acceptFollowRequest(requestId);
      setRequests((prev) => prev.filter((r) => r._id !== requestId));
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to accept');
    }
  }, []);

  const handleDecline = useCallback(async (requestId: string) => {
    try {
      await followApi.declineFollowRequest(requestId);
      setRequests((prev) => prev.filter((r) => r._id !== requestId));
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to decline');
    }
  }, []);

  const renderRequest = useCallback(({ item, index }: { item: FollowRequest; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50)}>
      <View style={styles.requestRow}>
        <Pressable
          style={styles.requestUser}
          onPress={() => router.push({ pathname: '/(screens)/user/[id]', params: { id: item.user.username } })}
        >
          <UserAvatar uri={item.user.profilePicture} size="md" />
          <View style={styles.requestInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.username, { color: colors.text }]}>{item.user.username}</Text>
              {item.user.isVerified && <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />}
            </View>
            <Text style={[styles.fullName, { color: colors.textSecondary }]}>{item.user.fullName}</Text>
            <Text style={[styles.time, { color: colors.textTertiary }]}>{timeAgo(item.createdAt)}</Text>
          </View>
        </Pressable>

        <View style={styles.requestActions}>
          <Pressable
            style={[styles.acceptBtn]}
            onPress={() => handleAccept(item._id)}
          >
            <LinearGradient colors={[...Colors.gradientPrimary]} style={styles.acceptGradient}>
              <Text style={styles.acceptText}>Accept</Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            style={[styles.declineBtn, { borderColor: colors.border }]}
            onPress={() => handleDecline(item._id)}
          >
            <Text style={[styles.declineText, { color: colors.textSecondary }]}>Decline</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  ), [colors]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={HitSlop.md}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Follow Requests</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderRequest}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="person-add-outline" size={40} color={Colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No requests</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                When people request to follow you, they'll appear here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, borderBottomWidth: 0.5 },
  headerTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },
  list: { paddingVertical: Spacing.sm },
  requestRow: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  requestUser: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  requestInfo: { flex: 1, marginLeft: Spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  username: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base },
  fullName: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, marginTop: 2 },
  time: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, marginTop: 2 },
  requestActions: { flexDirection: 'row', gap: Spacing.sm },
  acceptBtn: { flex: 1, borderRadius: Radii.sm, overflow: 'hidden' },
  acceptGradient: { paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radii.sm },
  acceptText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm, color: Colors.white },
  declineBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radii.sm, alignItems: 'center', borderWidth: 1 },
  declineText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: Spacing.xxl, gap: Spacing.md },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(108,92,231,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  emptyTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, textAlign: 'center' },
});
