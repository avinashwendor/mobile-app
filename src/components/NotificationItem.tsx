import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UserAvatar from './UserAvatar';
import { useTheme } from '../theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../theme/tokens';
import { timeAgo } from '../utils/formatters';
import GradientButton from './GradientButton';

interface NotificationItemData {
  id: string;
  sender?: {
    id: string;
    username: string;
    avatar_url: string;
    is_verified: boolean;
  };
  type: string;
  content: {
    text: string;
    target_type?: string;
    target_id?: string;
  };
  is_read: boolean;
  created_at: string;
}

interface NotificationItemProps {
  notification: NotificationItemData;
  onPress: (notification: NotificationItemData) => void;
  onFollowBack?: (userId: string) => void;
}

function notificationIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'like': return 'heart';
    case 'comment': return 'chatbubble';
    case 'follow': return 'person-add';
    case 'follow_request': return 'person-add-outline';
    case 'mention': return 'at';
    case 'collaboration_invite': return 'people';
    case 'message': return 'mail';
    default: return 'notifications';
  }
}

function notificationColor(type: string): string {
  switch (type) {
    case 'like': return Colors.likeFilled;
    case 'comment': return Colors.accent;
    case 'follow':
    case 'follow_request': return Colors.primary;
    case 'mention': return Colors.coral;
    case 'collaboration_invite': return Colors.emerald;
    default: return Colors.primary;
  }
}

function NotificationItemComponent({
  notification,
  onPress,
  onFollowBack,
}: NotificationItemProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={[
        styles.container,
        {
          backgroundColor: notification.is_read
            ? 'transparent'
            : colors.surfaceElevated,
        },
      ]}
      onPress={() => onPress(notification)}
    >
      {notification.sender ? (
        <UserAvatar uri={notification.sender.avatar_url} size="md" />
      ) : (
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: notificationColor(notification.type) + '20' },
          ]}
        >
          <Ionicons
            name={notificationIcon(notification.type)}
            size={20}
            color={notificationColor(notification.type)}
          />
        </View>
      )}

      <View style={styles.content}>
        <Text style={[styles.text, { color: colors.text }]} numberOfLines={2}>
          {notification.sender && (
            <Text style={styles.username}>
              {notification.sender.username}
            </Text>
          )}{' '}
          {notification.content.text}
          <Text style={[styles.time, { color: colors.textTertiary }]}>
            {'  '}
            {timeAgo(notification.created_at)}
          </Text>
        </Text>
      </View>

      {notification.type === 'follow' && onFollowBack && (
        <GradientButton
          title="Follow"
          onPress={() => onFollowBack(notification.sender?.id || '')}
          style={styles.followButton}
        />
      )}
    </Pressable>
  );
}

export const NotificationItem = memo(NotificationItemComponent);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderRadius: Radii.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  text: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
  },
  username: {
    fontFamily: Typography.fontFamily.semiBold,
  },
  time: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.xs,
  },
  followButton: {
    marginLeft: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
});
