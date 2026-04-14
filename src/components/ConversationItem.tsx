import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import UserAvatar from './UserAvatar';
import { useTheme } from '../theme/ThemeProvider';
import { Typography, Spacing, Radii } from '../theme/tokens';
import { timeAgo, truncate } from '../utils/formatters';

interface ConversationItemData {
  id: string;
  participants: Array<{
    user_id: string;
    username: string;
    display_name: string;
    avatar_url: string;
  }>;
  last_message?: {
    text: string;
    sender_id: string;
    sent_at: string;
  };
  type: 'dm' | 'group';
  group_name?: string;
  has_unread?: boolean;
}

interface ConversationItemProps {
  conversation: ConversationItemData;
  currentUserId: string;
  onPress: (convId: string) => void;
}

function ConversationItemComponent({
  conversation,
  currentUserId,
  onPress,
}: ConversationItemProps) {
  const { colors } = useTheme();

  // For DMs, show the other participant
  const otherParticipant = conversation.participants.find(
    (p) => p.user_id !== currentUserId,
  );
  const displayName =
    conversation.type === 'group'
      ? conversation.group_name || 'Group Chat'
      : otherParticipant?.display_name || 'Unknown';
  const avatarUrl =
    conversation.type === 'group'
      ? null
      : otherParticipant?.avatar_url || null;

  return (
    <Pressable
      style={[styles.container, { backgroundColor: conversation.has_unread ? colors.surfaceElevated : 'transparent' }]}
      onPress={() => onPress(conversation.id)}
    >
      <UserAvatar uri={avatarUrl} size="lg" />

      <View style={styles.content}>
        <Text
          style={[
            styles.name,
            {
              color: colors.text,
              fontFamily: conversation.has_unread
                ? Typography.fontFamily.bold
                : Typography.fontFamily.medium,
            },
          ]}
          numberOfLines={1}
        >
          {displayName}
        </Text>

        {conversation.last_message && (
          <Text
            style={[
              styles.lastMessage,
              {
                color: conversation.has_unread
                  ? colors.text
                  : colors.textTertiary,
                fontFamily: conversation.has_unread
                  ? Typography.fontFamily.medium
                  : Typography.fontFamily.regular,
              },
            ]}
            numberOfLines={1}
          >
            {truncate(conversation.last_message.text, 40)}
          </Text>
        )}
      </View>

      <View style={styles.meta}>
        {conversation.last_message && (
          <Text style={[styles.time, { color: colors.textTertiary }]}>
            {timeAgo(conversation.last_message.sent_at)}
          </Text>
        )}
        {conversation.has_unread && <View style={styles.unreadDot} />}
      </View>
    </Pressable>
  );
}

export const ConversationItem = memo(ConversationItemComponent);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderRadius: Radii.sm,
  },
  content: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  name: {
    fontSize: Typography.size.base,
    marginBottom: 2,
  },
  lastMessage: {
    fontSize: Typography.size.sm,
  },
  meta: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  time: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.xs,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6C5CE7',
  },
});
