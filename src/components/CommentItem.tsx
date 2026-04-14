import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UserAvatar from './UserAvatar';
import { useTheme } from '../theme/ThemeProvider';
import { Colors, Typography, Spacing, HitSlop } from '../theme/tokens';
import { timeAgo } from '../utils/formatters';

interface CommentItemData {
  id: string;
  user: {
    id: string;
    username: string;
    avatar_url: string;
    is_verified: boolean;
  };
  text: string;
  likes_count: number;
  replies_count: number;
  is_liked: boolean;
  created_at: string;
}

interface CommentItemProps {
  comment: CommentItemData;
  onLike: (commentId: string) => void;
  onReply: (commentId: string, username: string) => void;
  onUserPress: (userId: string) => void;
}

function CommentItemComponent({
  comment,
  onLike,
  onReply,
  onUserPress,
}: CommentItemProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Pressable onPress={() => onUserPress(comment.user.id)}>
        <UserAvatar uri={comment.user.avatar_url} size="sm" />
      </Pressable>

      <View style={styles.content}>
        <Text style={[styles.text, { color: colors.text }]}>
          <Text
            style={styles.username}
            onPress={() => onUserPress(comment.user.id)}
          >
            {comment.user.username}
          </Text>
          {comment.user.is_verified && ' ✓'}
          {'  '}
          {comment.text}
        </Text>

        <View style={styles.meta}>
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>
            {timeAgo(comment.created_at)}
          </Text>
          {comment.likes_count > 0 && (
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>
              {comment.likes_count} {comment.likes_count === 1 ? 'like' : 'likes'}
            </Text>
          )}
          <Pressable
            onPress={() => onReply(comment.id, comment.user.username)}
            hitSlop={HitSlop.sm}
          >
            <Text style={[styles.replyText, { color: colors.textTertiary }]}>
              Reply
            </Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={() => onLike(comment.id)}
        hitSlop={HitSlop.md}
        style={styles.likeButton}
      >
        <Ionicons
          name={comment.is_liked ? 'heart' : 'heart-outline'}
          size={14}
          color={comment.is_liked ? Colors.likeFilled : colors.textTertiary}
        />
      </Pressable>
    </View>
  );
}

export const CommentItem = memo(CommentItemComponent);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  content: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  text: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
  },
  username: {
    fontFamily: Typography.fontFamily.semiBold,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: Spacing.md,
  },
  metaText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.xs,
  },
  replyText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.xs,
  },
  likeButton: {
    paddingLeft: Spacing.sm,
    paddingTop: Spacing.xs,
  },
});
