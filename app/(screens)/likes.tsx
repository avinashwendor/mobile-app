import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../src/theme/tokens';
import UserAvatar from '../../src/components/UserAvatar';
import * as likeApi from '../../src/api/like.api';

interface LikeUser {
  _id: string;
  username: string;
  fullName: string;
  profilePicture: string;
  isVerified: boolean;
}

export default function LikesListScreen() {
  const { contentType, contentId } = useLocalSearchParams<{ contentType: string; contentId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [users, setUsers] = useState<LikeUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchLikes = useCallback(async (p: number) => {
    if (!contentType || !contentId) return;
    try {
      const result = await likeApi.getLikes(
        contentType as any,
        contentId,
        p,
        30,
      );
      const mapped = result.likes.map((l: any) => l.user || l);
      if (p === 1) {
        setUsers(mapped);
      } else {
        setUsers((prev) => [...prev, ...mapped]);
      }
      setHasMore(result.hasMore);
      setPage(p);
    } catch (err) {
      console.error('Failed to load likes:', err);
    }
  }, [contentType, contentId]);

  useEffect(() => {
    fetchLikes(1).then(() => setIsLoading(false));
  }, []);

  const renderUser = useCallback(({ item }: { item: LikeUser }) => (
    <Pressable
      style={styles.userRow}
      onPress={() => router.push({ pathname: '/(screens)/user/[id]', params: { id: item.username } })}
    >
      <UserAvatar uri={item.profilePicture} size="md" />
      <View style={styles.userInfo}>
        <View style={styles.nameRow}>
          <Text style={[styles.username, { color: colors.text }]}>{item.username}</Text>
          {item.isVerified && <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />}
        </View>
        <Text style={[styles.fullName, { color: colors.textSecondary }]}>{item.fullName}</Text>
      </View>
    </Pressable>
  ), [colors]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={HitSlop.md}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Likes</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUser}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          onEndReached={() => hasMore && fetchLikes(page + 1)}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No likes yet</Text>
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
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  userInfo: { flex: 1, marginLeft: Spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  username: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base },
  fullName: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base },
});
