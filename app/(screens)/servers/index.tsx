import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../../src/theme/tokens';
import { useAuthStore } from '../../../src/stores/authStore';
import * as serverApi from '../../../src/api/server.api';
import type { Server } from '../../../src/api/server.api';

type TabType = 'mine' | 'discover';

// ─── Server Card ─────────────────────────────────────────────────────────────

function ServerCard({
  server,
  index,
  tab,
  onOpen,
  onJoin,
}: {
  server: Server;
  index: number;
  tab: TabType;
  onOpen: () => void;
  onJoin: () => void;
}) {
  const { colors } = useTheme();
  const authUser = useAuthStore((s) => s.user);
  const isOwner = server.isOwner ?? String(server.ownerId) === String(authUser?._id);
  const isMember = server.isMember;

  const handleCardPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (tab === 'discover' && !isMember) {
      onJoin();
    } else {
      onOpen();
    }
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(300).springify()}>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          pressed && { opacity: 0.85 },
        ]}
        onPress={handleCardPress}
      >
        {/* Banner + Icon header */}
        <View style={styles.cardHeader}>
          {server.bannerUrl ? (
            <Image source={{ uri: server.bannerUrl }} style={styles.cardBanner} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={[Colors.primary, Colors.primaryLight]}
              style={styles.cardBanner}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          )}
          <View style={[styles.serverIconWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {server.iconUrl ? (
              <Image source={{ uri: server.iconUrl }} style={styles.serverIcon} contentFit="cover" />
            ) : (
              <LinearGradient
                colors={[Colors.primary, Colors.coral]}
                style={styles.serverIconGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.serverIconLetter}>{(server.name[0] ?? '#').toUpperCase()}</Text>
              </LinearGradient>
            )}
          </View>
        </View>

        {/* Info */}
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
              {server.name}
            </Text>
            {isOwner && tab === 'mine' && (
              <View style={styles.ownerBadge}>
                <Ionicons name="crown" size={11} color={Colors.primary} />
                <Text style={[styles.ownerBadgeText, { color: Colors.primary }]}>Owner</Text>
              </View>
            )}
            {!server.isPublic && (
              <Ionicons name="lock-closed" size={13} color={colors.textTertiary} style={{ marginLeft: 4 }} />
            )}
          </View>

          {server.description ? (
            <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
              {server.description}
            </Text>
          ) : null}

          <View style={styles.cardFooter}>
            <View style={styles.cardMeta}>
              <Ionicons name="people-outline" size={13} color={colors.textTertiary} />
              <Text style={[styles.cardMetaText, { color: colors.textTertiary }]}>
                {' '}{server.memberCount.toLocaleString()} members
              </Text>
              {server.categories.length > 0 && (
                <>
                  <Text style={[styles.cardMetaDot, { color: colors.textTertiary }]}>·</Text>
                  <Text style={[styles.cardMetaText, { color: colors.textTertiary }]} numberOfLines={1}>
                    {server.categories.slice(0, 2).join(', ')}
                  </Text>
                </>
              )}
            </View>

            {/* Explicit CTA button */}
            {tab === 'mine' ? (
              <Pressable
                style={[styles.cardActionBtn, { borderColor: Colors.primary }]}
                onPress={(e) => { e.stopPropagation(); onOpen(); }}
              >
                <Text style={[styles.cardActionText, { color: Colors.primary }]}>
                  {isOwner ? 'Manage' : 'Open'}
                </Text>
              </Pressable>
            ) : isMember ? (
              <Pressable
                style={[styles.cardActionBtn, { borderColor: Colors.primary }]}
                onPress={(e) => { e.stopPropagation(); onOpen(); }}
              >
                <Text style={[styles.cardActionText, { color: Colors.primary }]}>Open</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.cardActionBtnFilled}
                onPress={(e) => { e.stopPropagation(); onJoin(); }}
              >
                <LinearGradient
                  colors={[...Colors.gradientPrimary]}
                  style={styles.cardActionBtnGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.cardActionTextFilled}>Join</Text>
                </LinearGradient>
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Join Confirmation Sheet ──────────────────────────────────────────────────

function JoinConfirmSheet({
  server,
  visible,
  isJoining,
  onConfirm,
  onCancel,
}: {
  server: Server | null;
  visible: boolean;
  isJoining: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!server) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.sheetOverlay} onPress={onCancel}>
        <Pressable
          style={[
            styles.sheetContainer,
            { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing.base },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetPreview}>
            <View style={[styles.sheetIcon, { borderColor: colors.border }]}>
              {server.iconUrl ? (
                <Image source={{ uri: server.iconUrl }} style={{ width: 56, height: 56 }} contentFit="cover" />
              ) : (
                <LinearGradient
                  colors={[Colors.primary, Colors.coral]}
                  style={styles.sheetIconGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.sheetIconLetter}>{(server.name[0] ?? '#').toUpperCase()}</Text>
                </LinearGradient>
              )}
            </View>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{server.name}</Text>
            <Text style={[styles.sheetMeta, { color: colors.textSecondary }]}>
              {server.memberCount.toLocaleString()} members
              {server.categories.length > 0 ? ` · ${server.categories[0]}` : ''}
            </Text>
            {server.description ? (
              <Text style={[styles.sheetDesc, { color: colors.textSecondary }]} numberOfLines={3}>
                {server.description}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={onConfirm}
            disabled={isJoining}
            style={[styles.sheetJoinBtn, { opacity: isJoining ? 0.7 : 1 }]}
          >
            <LinearGradient
              colors={[...Colors.gradientPrimary]}
              style={styles.sheetJoinBtnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isJoining
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.sheetJoinBtnText}>Join Server</Text>}
            </LinearGradient>
          </Pressable>
          <Pressable onPress={onCancel} style={styles.sheetCancelBtn}>
            <Text style={[styles.sheetCancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function ServersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<TabType>('mine');
  const [myServers, setMyServers] = useState<Server[]>([]);
  const [discoverList, setDiscoverList] = useState<Server[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [isJoiningByCode, setIsJoiningByCode] = useState(false);
  const [showInviteInput, setShowInviteInput] = useState(false);

  // Join confirmation
  const [joinTarget, setJoinTarget] = useState<Server | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  // Refs — no stale closures on pagination
  const discoverCursorRef = useRef<string | null>(null);
  const discoverHasMoreRef = useRef(true);
  const initialLoadDone = useRef(false);

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  const fetchMine = useCallback(async () => {
    try {
      const result = await serverApi.getMyServers();
      setMyServers(result.servers);
    } catch {
      setMyServers([]);
    }
  }, []);

  const fetchDiscover = useCallback(async (reset = false) => {
    const cursor = reset ? null : discoverCursorRef.current;
    try {
      const result = await serverApi.discoverServers(cursor);
      discoverCursorRef.current = result.cursor;
      discoverHasMoreRef.current = result.hasMore;
      if (reset) {
        setDiscoverList(result.servers);
      } else {
        setDiscoverList((prev) => [...prev, ...result.servers]);
      }
    } catch {
      if (reset) setDiscoverList([]);
    }
  }, []);

  // ── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      await Promise.all([fetchMine(), fetchDiscover(true)]);
      setIsLoading(false);
      initialLoadDone.current = true;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Refresh "mine" whenever screen comes into focus ───────────────────────

  useFocusEffect(
    useCallback(() => {
      if (!initialLoadDone.current) return;
      fetchMine();
    }, [fetchMine]),
  );

  // ── Pull-to-refresh ───────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    if (activeTab === 'mine') {
      await fetchMine();
    } else {
      discoverCursorRef.current = null;
      discoverHasMoreRef.current = true;
      await fetchDiscover(true);
    }
    setIsRefreshing(false);
  }, [activeTab, fetchMine, fetchDiscover]);

  // ── Load more Discover ────────────────────────────────────────────────────

  const handleLoadMoreDiscover = useCallback(async () => {
    if (!discoverHasMoreRef.current || isLoadingMore) return;
    setIsLoadingMore(true);
    await fetchDiscover(false);
    setIsLoadingMore(false);
  }, [isLoadingMore, fetchDiscover]);

  // ── Join by invite code ───────────────────────────────────────────────────

  const handleJoinByCode = useCallback(async () => {
    const code = inviteCode.trim();
    if (!code) return;
    setIsJoiningByCode(true);
    try {
      const result = await serverApi.joinByInviteCode(code);
      setInviteCode('');
      setShowInviteInput(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await fetchMine();
      if (result.serverId) {
        router.push(`/(screens)/servers/${result.serverId}` as any);
      } else {
        setActiveTab('mine');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Invalid invite code.');
    } finally {
      setIsJoiningByCode(false);
    }
  }, [inviteCode, fetchMine, router]);

  // ── Open join confirmation sheet ──────────────────────────────────────────

  const handleRequestJoin = useCallback((server: Server) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setJoinTarget(server);
  }, []);

  // ── Confirm join ──────────────────────────────────────────────────────────

  const handleConfirmJoin = useCallback(async () => {
    if (!joinTarget) return;
    setIsJoining(true);
    try {
      await serverApi.joinServer(joinTarget._id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDiscoverList((prev) =>
        prev.map((s) =>
          s._id === joinTarget._id
            ? { ...s, isMember: true, memberCount: s.memberCount + 1 }
            : s,
        ),
      );
      await fetchMine();
      const targetId = joinTarget._id;
      setJoinTarget(null);
      router.push(`/(screens)/servers/${targetId}` as any);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Could not join server.');
      setJoinTarget(null);
    } finally {
      setIsJoining(false);
    }
  }, [joinTarget, fetchMine, router]);

  const currentData = activeTab === 'mine' ? myServers : discoverList;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={HitSlop.md}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Community Servers</Text>
        <View style={styles.headerActions}>
          <Pressable
            hitSlop={HitSlop.md}
            style={styles.headerBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowInviteInput((v) => !v); }}
          >
            <Ionicons name="link-outline" size={22} color={colors.text} />
          </Pressable>
          <Pressable
            hitSlop={HitSlop.md}
            style={styles.headerBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(screens)/servers/create' as any); }}
          >
            <Ionicons name="add" size={26} color={Colors.primary} />
          </Pressable>
        </View>
      </View>

      {/* Invite code input */}
      {showInviteInput && (
        <View style={[styles.inviteRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TextInput
            style={[styles.inviteInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
            placeholder="Paste invite code..."
            placeholderTextColor={colors.textTertiary}
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={handleJoinByCode}
            returnKeyType="go"
          />
          <Pressable
            onPress={handleJoinByCode}
            disabled={isJoiningByCode || !inviteCode.trim()}
            style={[styles.inviteJoinBtn, { opacity: inviteCode.trim() ? 1 : 0.4 }]}
          >
            {isJoiningByCode
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.inviteJoinText}>Join</Text>}
          </Pressable>
        </View>
      )}

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(['mine', 'discover'] as TabType[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <Pressable
              key={tab}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, { color: isActive ? Colors.primary : colors.textSecondary }]}>
                {tab === 'mine'
                  ? `My Servers${myServers.length > 0 ? ` (${myServers.length})` : ''}`
                  : 'Discover'}
              </Text>
              {isActive && <View style={[styles.tabIndicator, { backgroundColor: Colors.primary }]} />}
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : currentData.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="server-outline" size={52} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {activeTab === 'mine' ? 'No servers yet' : 'No servers found'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {activeTab === 'mine'
              ? 'Create a server or join one with an invite link'
              : 'Check back later for new communities'}
          </Text>
          {activeTab === 'mine' ? (
            <Pressable
              style={styles.createBtn}
              onPress={() => router.push('/(screens)/servers/create' as any)}
            >
              <LinearGradient colors={[...Colors.gradientPrimary]} style={styles.createBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.createBtnText}>Create a Server</Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable
              style={styles.createBtn}
              onPress={async () => {
                setIsRefreshing(true);
                discoverCursorRef.current = null;
                discoverHasMoreRef.current = true;
                await fetchDiscover(true);
                setIsRefreshing(false);
              }}
            >
              <LinearGradient colors={[...Colors.gradientPrimary]} style={styles.createBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.createBtnText}>Refresh</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={(item) => item._id}
          renderItem={({ item, index }) => (
            <ServerCard
              server={item}
              index={index}
              tab={activeTab}
              onOpen={() => router.push(`/(screens)/servers/${item._id}` as any)}
              onJoin={() => handleRequestJoin(item)}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
          }
          onEndReached={activeTab === 'discover' ? handleLoadMoreDiscover : undefined}
          onEndReachedThreshold={0.4}
          ListFooterComponent={isLoadingMore ? <ActivityIndicator color={Colors.primary} style={styles.footer} /> : null}
        />
      )}

      <JoinConfirmSheet
        server={joinTarget}
        visible={joinTarget !== null}
        isJoining={isJoining}
        onConfirm={handleConfirmJoin}
        onCancel={() => setJoinTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.md,
    flex: 1,
    textAlign: 'center',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerBtn: { marginLeft: Spacing.sm },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  inviteInput: {
    flex: 1,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.base,
    height: 42,
  },
  inviteJoinBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
    height: 42,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  inviteJoinText: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.base,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    position: 'relative',
  },
  tabActive: {},
  tabText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.base,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 2,
    borderRadius: 1,
  },
  list: { padding: Spacing.base, gap: Spacing.md },
  card: {
    borderRadius: Radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardHeader: { position: 'relative', height: 80 },
  cardBanner: { width: '100%', height: 80 },
  serverIconWrap: {
    position: 'absolute',
    bottom: -20,
    left: Spacing.base,
    width: 48,
    height: 48,
    borderRadius: Radii.lg,
    borderWidth: 2,
    overflow: 'hidden',
  },
  serverIcon: { width: 44, height: 44 },
  serverIconGradient: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serverIconLetter: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 20,
  },
  cardBody: {
    paddingTop: 28,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, gap: 6 },
  cardName: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.size.base,
    flex: 1,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '18',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
    gap: 3,
  },
  ownerBadgeText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 10,
  },
  cardDesc: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.sm,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', flex: 1 },
  cardMetaText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.xs,
  },
  cardMetaDot: { marginHorizontal: 4, fontSize: Typography.size.xs },
  cardActionBtn: {
    borderWidth: 1.5,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  cardActionText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.sm,
  },
  cardActionBtnFilled: {
    borderRadius: Radii.full,
    overflow: 'hidden',
  },
  cardActionBtnGrad: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActionTextFilled: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.sm,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl },
  emptyTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.md,
    marginTop: Spacing.base,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.base,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 22,
  },
  createBtn: { marginTop: Spacing.xl, borderRadius: Radii.full, overflow: 'hidden' },
  createBtnGrad: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radii.full },
  createBtnText: { color: Colors.white, fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base },
  footer: { paddingVertical: Spacing.base },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#88888888',
    alignSelf: 'center',
    marginBottom: Spacing.base,
  },
  sheetPreview: { alignItems: 'center', paddingVertical: Spacing.base },
  sheetIcon: {
    width: 64,
    height: 64,
    borderRadius: Radii.lg,
    borderWidth: 2,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  sheetIconGrad: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetIconLetter: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 26,
  },
  sheetTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.size.lg,
    textAlign: 'center',
    marginBottom: 4,
  },
  sheetMeta: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.sm,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  sheetDesc: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.base,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: Spacing.xs,
  },
  sheetJoinBtn: {
    borderRadius: Radii.full,
    overflow: 'hidden',
    marginTop: Spacing.lg,
  },
  sheetJoinBtnGrad: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.full,
  },
  sheetJoinBtnText: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.size.base,
  },
  sheetCancelBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  sheetCancelText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.base,
  },
});
