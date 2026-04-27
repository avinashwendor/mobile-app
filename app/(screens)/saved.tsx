import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator,
  Dimensions, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../src/theme/tokens';
import apiClient from '../../src/api/client';
import * as postApi from '../../src/api/post.api';
import type { SavedFeedItem } from '../../src/api/post.api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 2;
const GRID_COL = 3;
const TILE_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COL - 1)) / GRID_COL;

interface CollectionTile {
  name: string;
  count: number;
}

type ViewMode = 'all' | 'collections';

export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [mode, setMode] = useState<ViewMode>('all');
  const [savedItems, setSavedItems] = useState<SavedFeedItem[]>([]);
  const [collections, setCollections] = useState<CollectionTile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSaved = useCallback(async () => {
    try {
      const { items } = await postApi.getSavedPosts(1, 60);
      setSavedItems(items);
      setPostsError(null);
    } catch {
      setSavedItems([]);
      setPostsError('Saved posts are unavailable right now.');
    }
  }, []);

  const fetchCollections = useCallback(async () => {
    try {
      const { data } = await apiClient.get<{ success: boolean; data: { name: string; count: number }[] }>('/saved/collections');
      const rows = Array.isArray(data.data) ? data.data : [];
      setCollections(rows.map((r) => ({ name: r.name, count: Number(r.count ?? 0) })));
      setCollectionsError(null);
    } catch {
      setCollections([]);
      setCollectionsError('Collections are unavailable right now.');
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchSaved(), fetchCollections()]).finally(() => setIsLoading(false));
  }, [fetchSaved, fetchCollections]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchSaved(), fetchCollections()]);
    setIsRefreshing(false);
  }, [fetchCollections, fetchSaved]);

  const renderGridItem = useCallback(({ item }: { item: SavedFeedItem }) => {
    if (item.kind === 'post') {
      const first = item.post.media?.[0];
      if (!first) return null;
      const isVideo = first.type === 'video';
      return (
        <Pressable
          style={styles.gridItem}
          onPress={() => router.push({ pathname: '/(screens)/post/[id]', params: { id: item.post._id } })}
        >
          <Image
            source={{ uri: first.thumbnail || first.url }}
            style={styles.gridImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="normal"
            transition={150}
          />
          {isVideo && (
            <View style={styles.videoIcon}>
              <Ionicons name="play" size={14} color={Colors.white} />
            </View>
          )}
        </Pressable>
      );
    }
    const thumb = item.reel.video?.thumbnail || item.reel.video?.url;
    if (!thumb) return null;
    return (
      <Pressable
        style={styles.gridItem}
        onPress={() => router.push({ pathname: '/(tabs)/reels', params: { startReelId: item.reel._id } })}
      >
        <Image
          source={{ uri: thumb }}
          style={styles.gridImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
        />
        <View style={styles.videoIcon}>
          <Ionicons name="film" size={14} color={Colors.white} />
        </View>
      </Pressable>
    );
  }, [router]);

  const renderCollection = useCallback(({ item }: { item: CollectionTile }) => (
    <Pressable
      style={[styles.collectionCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
    >
      <View style={styles.collectionCover}>
        <View style={[styles.collectionPlaceholder, { backgroundColor: colors.surface }]}>
          <Ionicons name="bookmark" size={24} color={colors.textTertiary} />
        </View>
      </View>
      <Text style={[styles.collectionName, { color: colors.text }]}>{item.name}</Text>
      <Text style={[styles.collectionCount, { color: colors.textTertiary }]}>{item.count} items</Text>
    </Pressable>
  ), [colors]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={HitSlop.md}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Saved</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.toggleRow, { borderBottomColor: colors.border }]}>
        {(['all', 'collections'] as ViewMode[]).map((m) => (
          <Pressable
            key={m}
            style={[styles.toggleTab, mode === m && styles.toggleActive]}
            onPress={() => setMode(m)}
          >
            <Ionicons
              name={m === 'all' ? 'grid-outline' : 'albums-outline'}
              size={20}
              color={mode === m ? colors.text : colors.textTertiary}
            />
            <Text style={[styles.toggleLabel, { color: mode === m ? colors.text : colors.textTertiary }]}>
              {m === 'all' ? 'All Posts' : 'Collections'}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : mode === 'all' ? (
        <FlatList
          key="saved-all-grid"
          data={savedItems}
          renderItem={renderGridItem}
          keyExtractor={(item) => item.saveId}
          numColumns={GRID_COL}
          columnWrapperStyle={styles.gridRow}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="bookmark-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {postsError ? 'Unable to load saved posts' : 'Nothing saved yet'}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {postsError ?? 'Save posts to see them here'}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          key="saved-collections-grid"
          data={collections}
          renderItem={renderCollection}
          keyExtractor={(item) => item.name}
          numColumns={2}
          contentContainerStyle={styles.collectionsGrid}
          columnWrapperStyle={{ gap: Spacing.sm }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="albums-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {collectionsError ? 'Unable to load collections' : 'No collections'}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {collectionsError ?? 'Organize saved posts into collections'}
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
  toggleRow: { flexDirection: 'row', borderBottomWidth: 0.5 },
  toggleTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  toggleActive: { borderBottomColor: Colors.primary },
  toggleLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
  gridItem: { width: TILE_SIZE, height: TILE_SIZE },
  gridImage: { width: '100%', height: '100%' },
  videoIcon: { position: 'absolute', top: 6, right: 6 },
  collectionsGrid: { padding: Spacing.base },
  collectionCard: { flex: 1, borderRadius: Radii.lg, overflow: 'hidden', borderWidth: 1, marginBottom: Spacing.sm },
  collectionCover: { height: 120 },
  collectionPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  collectionName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  collectionCount: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, textAlign: 'center', paddingHorizontal: Spacing.xl },
});
