import React, { useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, ScrollView, Share,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../theme/tokens';
import UserAvatar from './UserAvatar';
import { AUTHORS } from '../data/dummyData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  contentType?: 'post' | 'reel' | 'story' | 'profile';
  contentId?: string;
  message?: string;
}

const QUICK_SHARE_USERS = AUTHORS.slice(0, 8);

const SHARE_ACTIONS = [
  { icon: 'paper-plane-outline' as const, label: 'Send as Message', key: 'message' },
  { icon: 'link-outline' as const, label: 'Copy Link', key: 'copy' },
  { icon: 'share-social-outline' as const, label: 'Share to...', key: 'share' },
  { icon: 'qr-code-outline' as const, label: 'QR Code', key: 'qr' },
];

const MORE_ACTIONS = [
  { icon: 'bookmark-outline' as const, label: 'Save', key: 'save' },
  { icon: 'flag-outline' as const, label: 'Report', key: 'report' },
  { icon: 'eye-off-outline' as const, label: 'Not Interested', key: 'hide' },
  { icon: 'information-circle-outline' as const, label: 'About this account', key: 'about' },
];

export default function ShareSheet({ visible, onClose, contentType = 'post', contentId, message }: ShareSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const handleAction = useCallback(async (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    switch (key) {
      case 'share':
        await Share.share({ message: message || `Check out this ${contentType}!` });
        break;
      case 'copy':
        // In a real app: Clipboard.setString(...)
        break;
    }
    onClose();
  }, [contentType, message, onClose]);

  const handleSendTo = useCallback((username: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing.md }]} onPress={(e) => e.stopPropagation()}>
          {/* Handle indicator */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.textTertiary }]} />
          </View>

          {/* Quick send to users */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.usersRow}>
            {QUICK_SHARE_USERS.map((u) => (
              <Pressable key={u._id} style={styles.userItem} onPress={() => handleSendTo(u.username)}>
                <UserAvatar uri={u.profilePicture} size="md" />
                <Text style={[styles.userName, { color: colors.textSecondary }]} numberOfLines={1}>{u.username.split('.')[0]}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Share actions */}
          <View style={[styles.actionsGrid, { borderTopColor: colors.border }]}>
            {SHARE_ACTIONS.map((action) => (
              <Pressable key={action.key} style={styles.actionItem} onPress={() => handleAction(action.key)}>
                <View style={[styles.actionIconBg, { backgroundColor: colors.surfaceElevated }]}>
                  <Ionicons name={action.icon} size={22} color={colors.text} />
                </View>
                <Text style={[styles.actionLabel, { color: colors.textSecondary }]} numberOfLines={1}>{action.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* More options */}
          <View style={[styles.moreSection, { borderTopColor: colors.border }]}>
            {MORE_ACTIONS.map((action, index) => (
              <Pressable
                key={action.key}
                style={[styles.moreItem, index < MORE_ACTIONS.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 0.5 }]}
                onPress={() => handleAction(action.key)}
              >
                <Ionicons name={action.icon} size={22} color={colors.text} />
                <Text style={[styles.moreLabel, { color: colors.text }]}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radii.xl, borderTopRightRadius: Radii.xl, maxHeight: '80%' },
  handleRow: { alignItems: 'center', paddingVertical: Spacing.sm },
  handle: { width: 36, height: 4, borderRadius: 2, opacity: 0.5 },
  usersRow: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, gap: Spacing.base },
  userItem: { alignItems: 'center', width: 64 },
  userName: { fontFamily: Typography.fontFamily.regular, fontSize: 11, marginTop: 6 },
  actionsGrid: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: Spacing.md, borderTopWidth: 0.5 },
  actionItem: { alignItems: 'center', width: (SCREEN_WIDTH - Spacing.base * 2) / 4 },
  actionIconBg: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  actionLabel: { fontFamily: Typography.fontFamily.regular, fontSize: 11, textAlign: 'center' },
  moreSection: { borderTopWidth: 0.5, marginHorizontal: Spacing.base },
  moreItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  moreLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base },
});
