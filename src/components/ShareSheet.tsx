import React, { useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, ScrollView, Share,
  Dimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../theme/tokens';
import UserAvatar from './UserAvatar';
import * as userApi from '../api/user.api';
import * as postApi from '../api/post.api';
import * as reelApi from '../api/reel.api';
import * as chatApi from '../api/chat.api';
import { buildContentDeepLink, buildContentShareMessage } from '../utils/contentLinks';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  contentType?: 'post' | 'reel' | 'story' | 'profile';
  contentId?: string;
  message?: string;
}

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
  const [quickShareUsers, setQuickShareUsers] = React.useState<userApi.UserSearchResult[]>([]);

  React.useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    userApi.getSuggestions(8)
      .then((users) => { if (!cancelled) setQuickShareUsers(users); })
      .catch(() => { if (!cancelled) setQuickShareUsers([]); });
    return () => { cancelled = true; };
  }, [visible]);

  const shareMessage = React.useMemo(() => {
    if (!contentId || (contentType !== 'post' && contentType !== 'reel')) {
      return message || `Check out this ${contentType}!`;
    }

    return buildContentShareMessage({
      contentType,
      contentId,
      headline: message,
    });
  }, [contentId, contentType, message]);

  const shareLink = React.useMemo(() => {
    if (!contentId || (contentType !== 'post' && contentType !== 'reel')) {
      return '';
    }

    return buildContentDeepLink({ contentType, contentId });
  }, [contentId, contentType]);

  const handleAction = useCallback(async (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      switch (key) {
        case 'message':
          await Share.share({ message: shareMessage });
          break;
        case 'share':
          await Share.share({ message: shareMessage });
          if (contentType === 'post' && contentId) {
            await postApi.sharePost(contentId, 'external', { platform: 'system' });
          } else if (contentType === 'reel' && contentId) {
            await reelApi.shareReel(contentId, 'external', { platform: 'system' });
          }
          break;
        case 'copy':
          if (shareLink) {
            await Clipboard.setStringAsync(shareLink);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          if (contentType === 'post' && contentId) {
            await postApi.sharePost(contentId, 'copy_link');
          } else if (contentType === 'reel' && contentId) {
            await reelApi.shareReel(contentId, 'copy_link');
          }
          break;
        case 'save':
          if (contentType === 'post' && contentId) {
            await postApi.toggleSavePost(contentId, false);
          } else if (contentType === 'reel' && contentId) {
            await reelApi.saveReel(contentId);
          }
          break;
        default:
          break;
      }
    } catch (err) {
      console.warn('[ShareSheet] action failed:', err);
    }
    onClose();
  }, [contentType, contentId, onClose, shareLink, shareMessage]);

  const handleSendTo = useCallback(async (user: userApi.UserSearchResult) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if ((contentType === 'post' || contentType === 'reel') && contentId) {
        const conv = await chatApi.createConversation([user._id], false);
        await chatApi.sendContentShare({
          conversationId: conv._id,
          contentType,
          contentId,
          text: shareMessage,
        });

        if (contentType === 'post') {
          await postApi.sharePost(contentId, 'dm', { recipientId: user._id });
        } else {
          await reelApi.shareReel(contentId, 'dm', { recipientId: user._id });
        }
      } else {
        const conv = await chatApi.createConversation([user._id], false);
        await chatApi.sendMessage(conv._id, message || `Check out this ${contentType}!`);
      }
    } catch (err) {
      console.warn('[ShareSheet] send-to failed:', err);
    }
    onClose();
  }, [contentType, contentId, message, onClose, shareMessage]);

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
            {quickShareUsers.length === 0 ? (
              <Text style={[styles.userName, { color: colors.textTertiary, paddingVertical: Spacing.md }]}>
                No suggestions yet
              </Text>
            ) : (
              quickShareUsers.map((u) => (
                <Pressable key={u._id} style={styles.userItem} onPress={() => handleSendTo(u)}>
                  <UserAvatar uri={u.profilePicture} size="md" />
                  <Text style={[styles.userName, { color: colors.textSecondary }]} numberOfLines={1}>
                    {u.username.split('.')[0]}
                  </Text>
                </Pressable>
              ))
            )}
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
