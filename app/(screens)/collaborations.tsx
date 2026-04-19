import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../../src/theme/tokens';
import apiClient from '../../src/api/client';
import { mapUser, type MobileUser } from '../../src/api/adapters';
import { useAuthStore } from '../../src/stores/authStore';
import * as collaborationApi from '../../src/api/collaboration.api';
import { searchUsers, type UserSearchResult } from '../../src/api/user.api';

type CollabStatus = 'pending' | 'accepted' | 'rejected' | 'revoked';
type FilterStatus = 'all' | 'active' | 'pending' | 'completed' | 'declined';

interface RawCollaboration {
  _id?: string;
  id?: string;
  content_type?: 'post' | 'reel';
  content_id?: string;
  inviter_id?: any;
  invitee_id?: any;
  status?: CollabStatus;
  watchtime_split?: { inviter_percent?: number; invitee_percent?: number };
  revenue_split?: { inviter_percent?: number; invitee_percent?: number };
  message?: string;
  created_at?: string;
  updated_at?: string;
  responded_at?: string;
}

interface Collaboration {
  id: string;
  contentType: 'post' | 'reel';
  contentId: string;
  inviter: MobileUser;
  invitee: MobileUser;
  status: CollabStatus;
  watchtimeSplit: { inviter: number; invitee: number };
  revenueSplit: { inviter: number; invitee: number };
  message: string;
  createdAt: string;
  isIncomingInvite: boolean;
}

const STATUS_COLORS: Record<CollabStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: '#FDCB6E20', text: '#FDCB6E', label: 'Pending' },
  accepted: { bg: '#00B89420', text: '#00B894', label: 'Accepted' },
  rejected: { bg: '#E1726420', text: '#E17264', label: 'Declined' },
  revoked: { bg: '#A0A0B420', text: '#A0A0B4', label: 'Revoked' },
};

export default function CollaborationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const currentUserId = useAuthStore((s) => s.user?._id ?? null);

  const [filter, setFilter] = useState<FilterStatus>('all');
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteContentType, setInviteContentType] = useState<'post' | 'reel'>('post');
  const [inviteContentId, setInviteContentId] = useState('');
  const [inviteeSearch, setInviteeSearch] = useState('');
  const [inviteeHits, setInviteeHits] = useState<UserSearchResult[]>([]);
  const [inviteeSelected, setInviteeSelected] = useState<UserSearchResult | null>(null);
  const [inviteNote, setInviteNote] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);

  const mapCollab = useCallback((raw: RawCollaboration, isIncomingInvite: boolean): Collaboration => ({
    id: String(raw._id ?? raw.id ?? ''),
    contentType: (raw.content_type ?? 'post') as 'post' | 'reel',
    contentId: String(raw.content_id ?? ''),
    inviter: mapUser(raw.inviter_id),
    invitee: mapUser(raw.invitee_id),
    status: (raw.status ?? 'pending') as CollabStatus,
    watchtimeSplit: {
      inviter: Number(raw.watchtime_split?.inviter_percent ?? 50),
      invitee: Number(raw.watchtime_split?.invitee_percent ?? 50),
    },
    revenueSplit: {
      inviter: Number(raw.revenue_split?.inviter_percent ?? 50),
      invitee: Number(raw.revenue_split?.invitee_percent ?? 50),
    },
    message: raw.message ?? '',
    createdAt: String(raw.created_at ?? new Date().toISOString()),
    isIncomingInvite,
  }), []);

  const fetchAll = useCallback(async () => {
    try {
      const [mineRes, pendingRes] = await Promise.all([
        apiClient.get<{ success: boolean; data: RawCollaboration[] }>('/collaborations/mine'),
        apiClient.get<{ success: boolean; data: RawCollaboration[] }>('/collaborations/pending'),
      ]);
      const mineList = Array.isArray(mineRes.data.data) ? mineRes.data.data : [];
      const pendingList = Array.isArray(pendingRes.data.data) ? pendingRes.data.data : [];

      const byId = new Map<string, Collaboration>();
      for (const raw of mineList) {
        const c = mapCollab(raw, false);
        if (c.id) byId.set(c.id, c);
      }
      // `/pending` is authoritative for incoming invites; override the flag.
      for (const raw of pendingList) {
        const c = mapCollab(raw, true);
        if (c.id) byId.set(c.id, c);
      }
      setCollaborations(Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setError(null);
    } catch {
      setCollaborations([]);
      setError('Collaborations are unavailable right now. Try again later.');
    }
  }, [mapCollab]);

  useEffect(() => {
    fetchAll().finally(() => setIsLoading(false));
  }, [fetchAll]);

  useEffect(() => {
    if (!inviteOpen) return;
    const q = inviteeSearch.trim();
    if (q.length < 2) {
      setInviteeHits([]);
      return;
    }
    const t = setTimeout(() => {
      setSearchBusy(true);
      searchUsers(q, 1, 12)
        .then((r) => setInviteeHits(r.users))
        .catch(() => setInviteeHits([]))
        .finally(() => setSearchBusy(false));
    }, 350);
    return () => clearTimeout(t);
  }, [inviteeSearch, inviteOpen]);

  const openInvite = useCallback(() => {
    setInviteContentType('post');
    setInviteContentId('');
    setInviteeSearch('');
    setInviteeHits([]);
    setInviteeSelected(null);
    setInviteNote('');
    setInviteOpen(true);
  }, []);

  const submitInvite = useCallback(async () => {
    const oid = /^[a-f\d]{24}$/i.exec(inviteContentId.trim());
    if (!oid) {
      Alert.alert('Invalid content', 'Paste the 24-character post or reel ID from your own content (you must be the owner).');
      return;
    }
    if (!inviteeSelected?._id) {
      Alert.alert('Invitee required', 'Search and select a user to invite.');
      return;
    }
    setInviteBusy(true);
    try {
      await collaborationApi.createCollaborationInvite({
        contentType: inviteContentType,
        contentId: oid[0],
        inviteeId: inviteeSelected._id,
        message: inviteNote.trim() || undefined,
      });
      Alert.alert('Invite sent', 'They will see this under pending collaborations.');
      setInviteOpen(false);
      await fetchAll();
    } catch (err: any) {
      const msg = err?.message || err?.response?.data?.error?.message || 'Could not send invite.';
      Alert.alert('Invite failed', msg);
    } finally {
      setInviteBusy(false);
    }
  }, [fetchAll, inviteContentId, inviteContentType, inviteNote, inviteeSelected]);

  const respond = useCallback(async (collabId: string, action: 'accept' | 'reject') => {
    setRespondingId(collabId);
    try {
      await apiClient.put(`/collaborations/${collabId}/respond`, { action });
      await fetchAll();
    } catch {
      Alert.alert('Unable to respond', 'Please try again in a moment.');
    } finally {
      setRespondingId(null);
    }
  }, [fetchAll]);

  const filtered = useMemo(() => {
    if (filter === 'all') return collaborations;
    // Map UI filter names to backend statuses.
    const statusMap: Record<Exclude<FilterStatus, 'all'>, CollabStatus> = {
      active: 'accepted',
      pending: 'pending',
      completed: 'accepted',
      declined: 'rejected',
    };
    return collaborations.filter((c) => c.status === statusMap[filter]);
  }, [collaborations, filter]);

  const totals = useMemo(() => ({
    active: collaborations.filter((c) => c.status === 'accepted').length,
    pending: collaborations.filter((c) => c.status === 'pending').length,
    declined: collaborations.filter((c) => c.status === 'rejected').length,
  }), [collaborations]);

  const renderCollaboration = useCallback(({ item, index }: { item: Collaboration; index: number }) => {
    const statusStyle = STATUS_COLORS[item.status];
    const counterpart: MobileUser = item.isIncomingInvite
      ? item.inviter
      : currentUserId && item.inviter._id === currentUserId
        ? item.invitee
        : item.inviter;
    const roleLabel = item.isIncomingInvite ? 'Invited you' : 'You invited';
    const mySharePercent = item.isIncomingInvite ? item.revenueSplit.invitee : item.revenueSplit.inviter;

    return (
      <Animated.View entering={FadeInDown.delay(index * 60).duration(400)}>
        <Pressable style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            {counterpart.profilePicture ? (
              <Image source={{ uri: counterpart.profilePicture }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.surface }]}>
                <Ionicons name="person" size={18} color={colors.textTertiary} />
              </View>
            )}
            <View style={styles.cardHeaderText}>
              <View style={styles.brandRow}>
                <Text style={[styles.brandName, { color: colors.text }]}>
                  {counterpart.fullName || counterpart.username || 'Unknown user'}
                </Text>
                {counterpart.isVerified && <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />}
              </View>
              <Text style={[styles.collabTitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {roleLabel} on {item.contentType === 'reel' ? 'a reel' : 'a post'}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>{statusStyle.label}</Text>
            </View>
          </View>

          {item.message ? (
            <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={3}>{item.message}</Text>
          ) : null}

          <View style={styles.splitsRow}>
            <SplitBar
              label="Your revenue"
              percent={mySharePercent}
              colors={colors}
              emphasize
            />
            <SplitBar
              label="Watchtime"
              percent={item.isIncomingInvite ? item.watchtimeSplit.invitee : item.watchtimeSplit.inviter}
              colors={colors}
            />
          </View>

          <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
            <View style={styles.dateSection}>
              <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
              <Text style={[styles.dateText, { color: colors.textTertiary }]}>
                {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
            {item.isIncomingInvite && item.status === 'pending' ? (
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => respond(item.id, 'reject')}
                  disabled={respondingId === item.id}
                  style={[styles.actionBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Decline</Text>
                </Pressable>
                <Pressable
                  onPress={() => respond(item.id, 'accept')}
                  disabled={respondingId === item.id}
                  style={[styles.actionBtn, styles.actionBtnPrimary]}
                >
                  {respondingId === item.id ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={[styles.actionBtnText, { color: Colors.white }]}>Accept</Text>
                  )}
                </Pressable>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    );
  }, [colors, currentUserId, respond, respondingId]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Collaborations</Text>
        <Pressable hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={openInvite}>
          <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
        </Pressable>
      </View>

      <Animated.View entering={FadeInDown.delay(50)}>
        <LinearGradient colors={[...Colors.gradientPrimary]} style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>Collaborations</Text>
            <Text style={styles.summaryValue}>{collaborations.length}</Text>
          </View>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStatItem}>
              <Text style={styles.summaryStatValue}>{totals.active}</Text>
              <Text style={styles.summaryStatLabel}>Active</Text>
            </View>
            <View style={styles.summaryStatItem}>
              <Text style={styles.summaryStatValue}>{totals.pending}</Text>
              <Text style={styles.summaryStatLabel}>Pending</Text>
            </View>
            <View style={styles.summaryStatItem}>
              <Text style={styles.summaryStatValue}>{totals.declined}</Text>
              <Text style={styles.summaryStatLabel}>Declined</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <View style={styles.filterRow}>
        {(['all', 'active', 'pending', 'declined'] as FilterStatus[]).map((f) => (
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

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderCollaboration}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {error ? 'Unable to load collaborations' : 'No collaborations'}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {error ?? 'Collaborations you create or are invited to will appear here.'}
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={inviteOpen} animationType="slide" transparent onRequestClose={() => setInviteOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setInviteOpen(false)} />
          <View style={[styles.modalSheet, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Invite collaborator</Text>
            <Text style={[styles.modalHint, { color: colors.textSecondary }]}>
              You can only invite others to content you own. Copy a post or reel ID from your profile or after opening the item.
            </Text>

            <View style={styles.typeRow}>
              {(['post', 'reel'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setInviteContentType(t)}
                  style={[
                    styles.typeChip,
                    inviteContentType === t && { backgroundColor: Colors.primary + '22', borderColor: Colors.primary },
                    { borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.typeChipText, { color: inviteContentType === t ? Colors.primary : colors.textSecondary }]}>
                    {t === 'post' ? 'Post' : 'Reel'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Content ID</Text>
            <TextInput
              value={inviteContentId}
              onChangeText={setInviteContentId}
              placeholder="e.g. 674a1b2c3d4e5f6789012345"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            />

            <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Invitee (search)</Text>
            <TextInput
              value={inviteeSelected ? `@${inviteeSelected.username}` : inviteeSearch}
              onChangeText={(v) => {
                setInviteeSelected(null);
                setInviteeSearch(v.replace(/^@/, ''));
              }}
              placeholder="Username"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            />
            {searchBusy ? <ActivityIndicator style={{ marginVertical: 8 }} color={Colors.primary} /> : null}
            <ScrollView style={styles.hitScroll} keyboardShouldPersistTaps="handled">
              {inviteeHits.map((u) => (
                <Pressable
                  key={u._id}
                  onPress={() => {
                    setInviteeSelected(u);
                    setInviteeSearch(u.username);
                    setInviteeHits([]);
                  }}
                  style={[styles.hitRow, { borderBottomColor: colors.border }]}
                >
                  <Text style={[styles.hitName, { color: colors.text }]}>{u.fullName || u.username}</Text>
                  <Text style={[styles.hitUser, { color: colors.textSecondary }]}>@{u.username}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Message (optional)</Text>
            <TextInput
              value={inviteNote}
              onChangeText={setInviteNote}
              placeholder="Add a short note…"
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={500}
              style={[styles.input, styles.inputMultiline, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            />

            <View style={styles.modalActions}>
              <Pressable onPress={() => setInviteOpen(false)} style={[styles.modalBtn, { borderColor: colors.border }]}>
                <Text style={{ color: colors.textSecondary, fontFamily: Typography.fontFamily.semiBold }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submitInvite}
                disabled={inviteBusy}
                style={[styles.modalBtn, styles.modalBtnPrimary, { opacity: inviteBusy ? 0.7 : 1 }]}
              >
                {inviteBusy ? <ActivityIndicator color={Colors.white} /> : (
                  <Text style={{ color: Colors.white, fontFamily: Typography.fontFamily.semiBold }}>Send invite</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function SplitBar({
  label, percent, colors, emphasize,
}: { label: string; percent: number; colors: any; emphasize?: boolean }) {
  const safe = Math.max(0, Math.min(100, percent));
  return (
    <View style={styles.splitItem}>
      <View style={styles.splitHeader}>
        <Text style={[styles.splitLabel, { color: colors.textTertiary }]}>{label}</Text>
        <Text style={[styles.splitPercent, { color: emphasize ? Colors.primary : colors.text }]}>{safe}%</Text>
      </View>
      <View style={[styles.splitTrack, { backgroundColor: colors.border }]}>
        <LinearGradient
          colors={emphasize ? [...Colors.gradientPrimary] : [Colors.accent, Colors.accentLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.splitFill, { width: `${safe}%` }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardHeaderText: { flex: 1, marginLeft: Spacing.sm },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  brandName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  collabTitle: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, marginTop: 2 },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radii.full },
  statusText: { fontFamily: Typography.fontFamily.semiBold, fontSize: 11 },
  description: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, lineHeight: 20, marginBottom: Spacing.sm },
  splitsRow: { gap: Spacing.sm, marginBottom: Spacing.sm },
  splitItem: {},
  splitHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  splitLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },
  splitPercent: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.xs },
  splitTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  splitFill: { height: 4, borderRadius: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 0.5, paddingTop: Spacing.sm, gap: Spacing.sm },
  dateSection: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },
  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radii.full, borderWidth: 1, minWidth: 72, alignItems: 'center' },
  actionBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  actionBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.xs },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  emptyTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.lg },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, textAlign: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    maxHeight: '88%',
  },
  modalTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.lg, marginBottom: Spacing.xs },
  modalHint: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, lineHeight: 20, marginBottom: Spacing.md },
  typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  typeChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radii.full, borderWidth: 1 },
  typeChipText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  fieldLabel: { fontFamily: Typography.fontFamily.medium, fontSize: 11, marginBottom: 4, marginTop: Spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.sm,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  hitScroll: { maxHeight: 160, marginBottom: Spacing.sm },
  hitRow: { paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  hitName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  hitUser: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, marginTop: 2 },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  modalBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  modalBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
});
