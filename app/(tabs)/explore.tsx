import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, TextInput,
  ActivityIndicator, Dimensions, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
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
const SMALL_TILE = (SCREEN_WIDTH - GRID_GAP * 2) / GRID_COL;
const LARGE_TILE = SMALL_TILE * 2 + GRID_GAP;

/**
 * Instagram-style mosaic layout:
 * Every 7 posts = 1 featured row (large left + 2 small right) + 2 normal rows (3 small each)
 * Pattern per group of 7: [BIG, sm, sm, sm, sm, sm, sm]
 */
function MosaicGrid({ posts, onPress }: { posts: Post[]; onPress: (id: string) => void }) {
  const rows: React.ReactNode[] = [];
  let i = 0;

  while (i < posts.length) {
    const groupStart = i;

    // --- Featured row: big tile left + 2 small tiles right ---
    const bigPost = posts[groupStart];
    const sm1 = posts[groupStart + 1];
    const sm2 = posts[groupStart + 2];

    if (bigPost) {
      rows.push(
        <Animated.View key={`feat-${groupStart}`} entering={FadeInDown.delay(50).duration(300)} style={styles.featuredRow}>
          {/* Big tile */}
          <Pressable style={styles.featuredLarge} onPress={() => onPress(bigPost._id)}>
            <Image
              source={{ uri: bigPost.media[0]?.thumbnail || bigPost.media[0]?.url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={250}
            />
            {bigPost.media[0]?.type === 'video' && (
              <View style={styles.videoChip}>
                <Ionicons name="play" size={12} color={Colors.white} />
              </View>
            )}
            {bigPost.media.length > 1 && (
              <View style={styles.multiChip}>
                <Ionicons name="copy-outline" size={12} color={Colors.white} />
              </View>
            )}
          </Pressable>

          {/* 2 small tiles stacked */}
          <View style={styles.featuredSmallCol}>
            {sm1 ? (
              <Pressable style={styles.featuredSmall} onPress={() => onPress(sm1._id)}>
                <Image
                  source={{ uri: sm1.media[0]?.thumbnail || sm1.media[0]?.url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={250}
                />
                {sm1.media[0]?.type === 'video' && (
                  <View style={styles.videoChip}>
                    <Ionicons name="play" size={10} color={Colors.white} />
                  </View>
                )}
              </Pressable>
            ) : <View style={[styles.featuredSmall, { backgroundColor: '#111' }]} />}
            {sm2 ? (
              <Pressable style={[styles.featuredSmall, { marginTop: GRID_GAP }]} onPress={() => onPress(sm2._id)}>
                <Image
                  source={{ uri: sm2.media[0]?.thumbnail || sm2.media[0]?.url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={250}
                />
                {sm2.media.length > 1 && (
                  <View style={styles.multiChip}>
                    <Ionicons name="copy-outline" size={10} color={Colors.white} />
                  </View>
                )}
              </Pressable>
            ) : <View style={[styles.featuredSmall, { marginTop: GRID_GAP, backgroundColor: '#111' }]} />}
          </View>
        </Animated.View>,
      );
      i += 3;
    }

    // --- 2 normal rows (6 more posts, 3 per row) ---
    for (let row = 0; row < 2; row++) {
      const rowPosts = posts.slice(i, i + 3);
      if (rowPosts.length === 0) break;

      rows.push(
        <Animated.View key={`row-${i}`} entering={FadeInDown.delay(80).duration(280)} style={styles.gridRow}>
          {rowPosts.map((post, idx) => (
            <Pressable
              key={post._id}
              style={[styles.gridItem, idx < rowPosts.length - 1 && { marginRight: GRID_GAP }]}
              onPress={() => onPress(post._id)}
            >
              <Image
                source={{ uri: post.media[0]?.thumbnail || post.media[0]?.url }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
              />
              {post.media[0]?.type === 'video' && (
                <View style={styles.videoChip}>
                  <Ionicons name="play" size={11} color={Colors.white} />
                </View>
              )}
              {post.media.length > 1 && (
                <View style={styles.multiChip}>
                  <Ionicons name="copy-outline" size={11} color={Colors.white} />
                </View>
              )}
            </Pressable>
          ))}
          {/* Fill empty cells with placeholder */}
          {rowPosts.length < 3 && Array.from({ length: 3 - rowPosts.length }).map((_, ph) => (
            <View key={`ph-${ph}`} style={[styles.gridItem, { backgroundColor: '#0A0A0F', marginRight: ph < 2 - rowPosts.length ? GRID_GAP : 0 }]} />
          ))}
        </Animated.View>,
      );
      i += 3;
    }
  }

  return <View>{rows}</View>;
}

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

  const renderSearchResult = useCallback(({ item, index }: { item: UserSearchResult; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 30).duration(250)}>
      <Pressable
        style={[styles.searchResultItem, { borderBottomColor: colors.border }]}
        onPress={() => router.push({ pathname: '/(screens)/user/[id]', params: { id: item.username } })}
      >
        <UserAvatar uri={item.profilePicture} size="md" />
        <View style={styles.searchResultText}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={[styles.searchUsername, { color: colors.text }]}>{item.username}</Text>
            {item.isVerified && <Ionicons name="checkmark-circle" size={15} color={Colors.accent} />}
          </View>
          <Text style={[styles.searchFullName, { color: colors.textSecondary }]}>{item.fullName}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </Pressable>
    </Animated.View>
  ), [colors, router]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Search bar */}
      <View style={[styles.searchBarWrap, { paddingTop: insets.top + Spacing.sm, backgroundColor: colors.background }]}>
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
            <Pressable onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      {isSearchMode ? (
        /* Search results */
        <FlatList
          key="search-results"
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.searchList}
          ListEmptyComponent={
            isSearching ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={44} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No users found</Text>
              </View>
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
            key="explore-grid"
            data={[{ key: 'mosaic' }]}
            renderItem={() => (
              <MosaicGrid
                posts={posts}
                onPress={(id) => router.push({ pathname: '/(screens)/post/[id]', params: { id } })}
              />
            )}
            keyExtractor={(item) => item.key}
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

  searchBarWrap: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    zIndex: 10,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.full,
    borderWidth: 1,
    height: 44,
    gap: Spacing.sm,
  },
  searchTextInput: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.base,
  },

  // Search results
  searchList: { paddingHorizontal: Spacing.base },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    gap: Spacing.md,
  },
  searchResultText: { flex: 1 },
  searchUsername: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base },
  searchFullName: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, marginTop: 2 },

  // Mosaic grid
  featuredRow: {
    flexDirection: 'row',
    marginBottom: GRID_GAP,
  },
  featuredLarge: {
    width: LARGE_TILE,
    height: LARGE_TILE,
    overflow: 'hidden',
    backgroundColor: '#111',
    marginRight: GRID_GAP,
  },
  featuredSmallCol: {
    flex: 1,
  },
  featuredSmall: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#111',
    height: SMALL_TILE,
  },

  // Normal 3-col rows
  gridRow: {
    flexDirection: 'row',
    marginBottom: GRID_GAP,
  },
  gridItem: {
    width: SMALL_TILE,
    height: SMALL_TILE,
    overflow: 'hidden',
    backgroundColor: '#111',
  },

  // Overlay badges
  videoChip: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 99,
    padding: 4,
  },
  multiChip: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 99,
    padding: 4,
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: Spacing.md,
  },
  emptyText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.base,
    textAlign: 'center',
  },
});
