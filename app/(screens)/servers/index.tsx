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
import Animated, {
  FadeInDown,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  ZoomIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../../src/theme/tokens';
import { useAuthStore } from '../../../src/stores/authStore';
import * as serverApi from '../../../src/api/server.api';
import type { Server } from '../../../src/api/server.api';

type TabType = 'mine' | 'discover';

// ─── Animated Success Overlay ─────────────────────────────────────────────────

function JoinSuccessOverlay({
  server,
  visible,
  onNavigate,
}: {
  server: Server | null;
  visible: boolean;
  onNavigate: () => void;
}) {
  const { colors } = useTheme();

  useEffect(() => {
    if (visible) {
      // Auto-navigate after 1.6s
      const timer = setTimeout(() => {
        onNavigate();
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, [visible, onNavigate]);

  if (!server || !visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['rgba(108,92,231,0.95)', 'rgba(162,155,254,0.95)']}
        style={styles.successOverlay}
      >
        <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.successContent}>
          <View style={styles.successIconWrap}>
            <LinearGradient
              colors={['#fff', '#f0edff']}
              style={styles.successIconGrad}
            >
              {server.iconUrl ? (
                <Image
                  source={{ uri: server.iconUrl }}
                  style={{ width: 64, height: 64, borderRadius: 16 }}
                  contentFit="cover"
                />
              ) : (
                <Text style={styles.successIconLetter}>
                  {(server.name[0] ?? '#').toUpperCase()}
                </Text>
              )}
            </LinearGradient>
          </View>

          <Animated.View entering={FadeInDown.delay(150).springify()}>
            <View style={styles.successCheckCircle}>
              <Ionicons name="checkmark" size={20} color="#6C5CE7" />
            </View>
          </Animated.View>

          <Animated.Text entering={FadeInDown.delay(250)} style={styles.successTitle}>
            You joined!
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(350)} style={styles.successServerName}>
            {server.name}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(450)} style={styles.successSub}>
            Taking you there now…
          </Animated.Text>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

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
                <Ionicons name="ribbon" size={11} color={Colors.primary} />
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

// ─── Join Bottom Sheet ────────────────────────────────────────────────────────

type JoinSheetPhase = 'preview' | 'joining' | 'done';

function JoinBottomSheet({
  server,
  visible,
  onConfirm,
  onCancel,
}: {
  server: Server | null;
  visible: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<JoinSheetPhase>('preview');

  // Reset phase when sheet opens/closes
  useEffect(() => {
    if (visible) {
      setPhase('preview');
    }
  }, [visible]);

  const handleJoin = async () => {
    setPhase('joining');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await onConfirm();
    // onConfirm handles navigation — if we get here without error, just reset
  };

  if (!server) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={phase === 'preview' ? onCancel : undefined}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        entering={FadeIn.duration(250)}
        exiting={FadeOut.duration(200)}
        style={styles.sheetBackdrop}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={phase === 'preview' ? onCancel : undefined} />

        {/* Sheet */}
        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(200)}
          exiting={SlideOutDown.duration(280)}
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.surface,
              paddingBottom: insets.bottom + Spacing.lg,
            },
          ]}
        >
          {/* Handle */}
          <View style={styles.sheetHandle} />

          {/* Server banner */}
          <View style={styles.sheetBanner}>
            {server.bannerUrl ? (
              <Image source={{ uri: server.bannerUrl }} style={styles.sheetBannerImg} contentFit="cover" />
            ) : (
              <LinearGradient
                colors={[Colors.primary, Colors.primaryLight]}
                style={styles.sheetBannerImg}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            )}
            {/* Frosted icon overlay */}
            <View style={[styles.sheetIconContainer, { borderColor: colors.surface }]}>
              {server.iconUrl ? (
                <Image
                  source={{ uri: server.iconUrl }}
                  style={{ width: 72, height: 72 }}
                  contentFit="cover"
                />
              ) : (
                <LinearGradient
                  colors={[Colors.primary, Colors.coral]}
                  style={styles.sheetIconGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.sheetIconLetter}>
                    {(server.name[0] ?? '#').toUpperCase()}
                  </Text>
                </LinearGradient>
              )}
            </View>
          </View>

          {/* Info */}
          <View style={styles.sheetInfo}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{server.name}</Text>

            {/* Meta pills */}
            <View style={styles.sheetMetaRow}>
              <View style={[styles.metaPill, { backgroundColor: Colors.primary + '18' }]}>
                <Ionicons name="people" size={12} color={Colors.primary} />
                <Text style={[styles.metaPillText, { color: Colors.primary }]}>
                  {server.memberCount.toLocaleString()} members
                </Text>
              </View>
              {server.categories.length > 0 && (
                <View style={[styles.metaPill, { backgroundColor: colors.border }]}>
                  <Ionicons name="pricetag" size={12} color={colors.textSecondary} />
                  <Text style={[styles.metaPillText, { color: colors.textSecondary }]}>
                    {server.categories[0]}
                  </Text>
                </View>
              )}
              {!server.isPublic && (
                <View style={[styles.metaPill, { backgroundColor: Colors.amber + '20' }]}>
                  <Ionicons name="lock-closed" size={12} color={Colors.amber} />
                  <Text style={[styles.metaPillText, { color: Colors.amber }]}>Private</Text>
                </View>
              )}
            </View>

            {/* Description */}
            {server.description ? (
              <Text
                style={[styles.sheetDesc, { color: colors.textSecondary }]}
                numberOfLines={3}
              >
                {server.description}
              </Text>
            ) : null}

            {/* What you'll get */}
            <View style={[styles.sheetFeatureBox, { backgroundColor: colors.border + '50', borderColor: colors.border }]}>
              <View style={styles.sheetFeatureRow}>
                <Ionicons name="chatbubbles" size={16} color={Colors.primary} />
                <Text style={[styles.sheetFeatureText, { color: colors.text }]}>
                  Access all public channels
                </Text>
              </View>
              <View style={styles.sheetFeatureRow}>
                <Ionicons name="people" size={16} color={Colors.emerald} />
                <Text style={[styles.sheetFeatureText, { color: colors.text }]}>
                  Connect with {server.memberCount.toLocaleString()} members
                </Text>
              </View>
              <View style={styles.sheetFeatureRow}>
                <Ionicons name="notifications" size={16} color={Colors.amber} />
                <Text style={[styles.sheetFeatureText, { color: colors.text }]}>
                  Get real-time notifications
                </Text>
              </View>
            </View>
          </View>

          {/* CTA */}
          <View style={styles.sheetActions}>
            <Pressable
              onPress={phase === 'preview' ? handleJoin : undefined}
              disabled={phase !== 'preview'}
              style={[styles.sheetJoinBtn, { opacity: phase === 'preview' ? 1 : 0.8 }]}
            >
              <LinearGradient
                colors={[...Colors.gradientPrimary]}
                style={styles.sheetJoinBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {phase === 'joining' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator color={Colors.white} size="small" />
                    <Text style={styles.sheetJoinBtnText}>Joining…</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="enter-outline" size={20} color={Colors.white} />
                    <Text style={styles.sheetJoinBtnText}>Join Server</Text>
                  </View>
                )}
              </LinearGradient>
            </Pressable>

            {phase === 'preview' && (
              <Pressable onPress={onCancel} style={styles.sheetCancelBtn}>
                <Text style={[styles.sheetCancelText, { color: colors.textSecondary }]}>
                  Maybe later
                </Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

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

  // Join sheet state
  const [joinTarget, setJoinTarget] = useState<Server | null>(null);
  const [showJoinSheet, setShowJoinSheet] = useState(false);

  // Success overlay
  const [successServer, setSuccessServer] = useState<Server | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const pendingNavigationId = useRef<string | null>(null);

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

  // ── Open join sheet ───────────────────────────────────────────────────────

  const handleRequestJoin = useCallback((server: Server) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setJoinTarget(server);
    setShowJoinSheet(true);
  }, []);

  // ── Navigate to server (called from success overlay) ─────────────────────

  const navigateToServer = useCallback(() => {
    const id = pendingNavigationId.current;
    setShowSuccess(false);
    setSuccessServer(null);
    pendingNavigationId.current = null;
    if (id) {
      router.push(`/(screens)/servers/${id}` as any);
    }
  }, [router]);

  // ── Confirm join (called from sheet's onConfirm) ──────────────────────────

  const handleConfirmJoin = useCallback(async () => {
    if (!joinTarget) return;
    try {
      await serverApi.joinServer(joinTarget._id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Update discover list optimistically
      setDiscoverList((prev) =>
        prev.map((s) =>
          s._id === joinTarget._id
            ? { ...s, isMember: true, memberCount: s.memberCount + 1 }
            : s,
        ),
      );

      // Refresh my servers in background
      fetchMine().catch(() => {});

      // Store navigation target
      pendingNavigationId.current = joinTarget._id;
      const serverForSuccess = { ...joinTarget };

      // 1. Close the bottom sheet first
      setShowJoinSheet(false);
      setJoinTarget(null);

      // 2. After sheet closes, show success overlay which auto-navigates
      setTimeout(() => {
        setSuccessServer(serverForSuccess);
        setShowSuccess(true);
      }, 350);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Could not join server.');
      setShowJoinSheet(false);
      setJoinTarget(null);
    }
  }, [joinTarget, fetchMine]);

  const handleCancelJoin = useCallback(() => {
    setShowJoinSheet(false);
    setTimeout(() => setJoinTarget(null), 350);
  }, []);

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

      {/* Join Bottom Sheet */}
      <JoinBottomSheet
        server={joinTarget}
        visible={showJoinSheet}
        onConfirm={handleConfirmJoin}
        onCancel={handleCancelJoin}
      />

      {/* Join Success Overlay — renders above everything */}
      <JoinSuccessOverlay
        server={successServer}
        visible={showSuccess}
        onNavigate={navigateToServer}
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

  // ── Join Bottom Sheet ──────────────────────────────────────────────────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#88888866',
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sheetBanner: {
    height: 110,
    position: 'relative',
    marginBottom: 44,
  },
  sheetBannerImg: {
    width: '100%',
    height: 110,
  },
  sheetIconContainer: {
    position: 'absolute',
    bottom: -38,
    left: '50%',
    marginLeft: -40,
    width: 80,
    height: 80,
    borderRadius: Radii.xl,
    borderWidth: 4,
    overflow: 'hidden',
  },
  sheetIconGrad: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetIconLetter: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 30,
  },
  sheetInfo: {
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  sheetTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.size.xl,
    textAlign: 'center',
  },
  sheetMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  metaPillText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.xs,
  },
  sheetDesc: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  sheetFeatureBox: {
    width: '100%',
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  sheetFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sheetFeatureText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.sm,
  },
  sheetActions: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  sheetJoinBtn: {
    borderRadius: Radii.full,
    overflow: 'hidden',
  },
  sheetJoinBtnGrad: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.full,
  },
  sheetJoinBtnText: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.size.base,
    letterSpacing: 0.3,
  },
  sheetCancelBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  sheetCancelText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.size.base,
  },

  // ── Success Overlay ────────────────────────────────────────────────────────
  successOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successContent: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
  },
  successIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  successIconLetter: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 36,
  },
  successIconGrad: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCheckCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  successTitle: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.size.xxl,
    textAlign: 'center',
  },
  successServerName: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.lg,
    textAlign: 'center',
  },
  successSub: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.sm,
    textAlign: 'center',
  },
});
