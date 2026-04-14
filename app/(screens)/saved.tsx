import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../src/theme/tokens';
import apiClient from '../../src/api/client';
import { getDummySavedItems, getDummyCollections } from '../../src/data/dummyData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 2;
const GRID_COL = 3;
const TILE_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COL - 1)) / GRID_COL;

interface SavedPost {
  _id: string;
  post: {
    _id: string;
    media: { url: string; thumbnail?: string; type: string }[];
    likesCount: number;
    commentsCount: number;
  };
  collection?: string;
  createdAt: string;
}

interface Collection {
  _id: string;
  name: string;
  coverImage?: string;
  count: number;
}

type ViewMode = 'all' | 'collections';

export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [mode, setMode] = useState<ViewMode>('all');
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSaved = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/saved', { params: { page: 1, limit: 60 } });
      setSavedPosts(data.data.savedItems || []);
    } catch (err) {
      setSavedPosts(getDummySavedItems() as any);
    }
  }, []);

  const fetchCollections = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/saved/collections');
      setCollections(data.data.collections || []);
    } catch (err) {
      setCollections(getDummyCollections().collections);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchSaved(), fetchCollections()]).then(() => setIsLoading(false));
  }, []);

  const renderGridItem = useCallback(({ item }: { item: SavedPost }) => {
    const post = item.post;
    if (!post) return null;
    const isVideo = post.media?.[0]?.type === 'video';
    return (
      <Pressable
        style={styles.gridItem}
        onPress={() => router.push({ pathname: '/(screens)/post/[id]', params: { id: post._id } })}
      >
        <Image
          source={{ uri: post.media?.[0]?.thumbnail || post.media?.[0]?.url }}
          style={styles.gridImage}
          contentFit="cover"
        />
        {isVideo && (
          <View style={styles.videoIcon}>
            <Ionicons name="play" size={14} color={Colors.white} />
          </View>
        )}
      </Pressable>
    );
  }, []);

  const renderCollection = useCallback(({ item }: { item: Collection }) => (
    <Pressable
      style={[styles.collectionCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
    >
      <View style={styles.collectionCover}>
        {item.coverImage ? (
          <Image source={{ uri: item.coverImage }} style={styles.collectionImage} contentFit="cover" />
        ) : (
          <View style={[styles.collectionPlaceholder, { backgroundColor: colors.surface }]}>
            <Ionicons name="bookmark" size={24} color={colors.textTertiary} />
          </View>
        )}
      </View>
      <Text style={[styles.collectionName, { color: colors.text }]}>{item.name}</Text>
      <Text style={[styles.collectionCount, { color: colors.textTertiary }]}>{item.count} items</Text>
    </Pressable>
  ), [colors]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={HitSlop.md}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Saved</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Mode toggle */}
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
          data={savedPosts}
          renderItem={renderGridItem}
          keyExtractor={(item) => item._id}
          numColumns={GRID_COL}
          columnWrapperStyle={styles.gridRow}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="bookmark-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing saved yet</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Save posts to see them here</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={collections}
          renderItem={renderCollection}
          keyExtractor={(item) => item._id}
          numColumns={2}
          contentContainerStyle={styles.collectionsGrid}
          columnWrapperStyle={{ gap: Spacing.sm }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="albums-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No collections</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Organize saved posts into collections</Text>
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
  collectionImage: { width: '100%', height: '100%' },
  collectionPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  collectionName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  collectionCount: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm },
});
