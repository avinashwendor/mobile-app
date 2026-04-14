import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, TextInput,
  ActivityIndicator, Dimensions, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../../src/theme/tokens';
import UserAvatar from '../../src/components/UserAvatar';
import * as postApi from '../../src/api/post.api';
import * as userApi from '../../src/api/user.api';
import type { Post } from '../../src/api/post.api';
import type { UserSearchResult } from '../../src/api/user.api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 2;
const GRID_COL = 3;
const TILE_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COL - 1)) / GRID_COL;

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [posts, setPosts] = useState<Post[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchExplore = useCallback(async (pageNum: number, refresh = false) => {
    try {
      const result = await postApi.getExplore(pageNum, 21);
      if (refresh) {
        setPosts(result.posts);
      } else {
        setPosts((prev) => [...prev, ...result.posts]);
      }
      setHasMore(result.hasMore);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to load explore:', err);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchExplore(1, true);
      setIsLoading(false);
    })();
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchExplore(1, true);
    setIsRefreshing(false);
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore) return;
    await fetchExplore(page + 1);
  }, [hasMore, page]);

  // Debounced user search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const result = await userApi.searchUsers(searchQuery.trim());
        setSearchResults(result.users);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isSearchMode = searchQuery.trim().length >= 2;

  const renderGridItem = useCallback(({ item, index }: { item: Post; index: number }) => {
    const isVideo = item.media[0]?.type === 'video';
    return (
      <Pressable
        onPress={() => router.push({ pathname: '/(screens)/post/[id]', params: { id: item._id } })}
        style={styles.gridItem}
      >
        <Image
          source={{ uri: item.media[0]?.thumbnail || item.media[0]?.url }}
          style={styles.gridImage}
          contentFit="cover"
          transition={200}
        />
        {isVideo && (
          <View style={styles.videoIndicator}>
            <Ionicons name="play" size={16} color={Colors.white} />
          </View>
        )}
        {item.media.length > 1 && (
          <View style={styles.carouselIndicator}>
            <Ionicons name="copy-outline" size={14} color={Colors.white} />
          </View>
        )}
      </Pressable>
    );
  }, []);

  const renderSearchResult = useCallback(({ item }: { item: UserSearchResult }) => (
    <Pressable
      style={styles.searchResultItem}
      onPress={() => router.push({ pathname: '/(screens)/user/[id]', params: { id: item.username } })}
    >
      <UserAvatar uri={item.profilePicture} size="md" />
      <View style={styles.searchResultText}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={[styles.searchUsername, { color: colors.text }]}>{item.username}</Text>
          {item.isVerified && <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />}
        </View>
        <Text style={[styles.searchFullName, { color: colors.textSecondary }]}>{item.fullName}</Text>
      </View>
    </Pressable>
  ), [colors]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Search bar */}
      <View style={[styles.searchBar, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={[styles.searchInput, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search users..."
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchTextInput, { color: colors.text }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      {isSearchMode ? (
        /* Search results */
        <FlatList
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.searchList}
          ListEmptyComponent={
            isSearching ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
            ) : (
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No users found</Text>
            )
          }
        />
      ) : (
        /* Explore grid */
        isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={posts}
            renderItem={renderGridItem}
            keyExtractor={(item) => item._id}
            numColumns={GRID_COL}
            columnWrapperStyle={styles.gridRow}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="compass-outline" size={48} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nothing to explore yet</Text>
              </View>
            }
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchBar: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  searchInput: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, borderRadius: Radii.md, borderWidth: 1, height: 42, gap: Spacing.sm },
  searchTextInput: { flex: 1, fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base },
  searchList: { paddingHorizontal: Spacing.base },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' },
  searchResultText: { marginLeft: Spacing.md, flex: 1 },
  searchUsername: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base },
  searchFullName: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, marginTop: 2 },
  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
  gridItem: { width: TILE_SIZE, height: TILE_SIZE },
  gridImage: { width: '100%', height: '100%' },
  videoIndicator: { position: 'absolute', top: 6, right: 6 },
  carouselIndicator: { position: 'absolute', top: 6, right: 6 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100, gap: Spacing.md },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base, textAlign: 'center', marginTop: 40 },
});
