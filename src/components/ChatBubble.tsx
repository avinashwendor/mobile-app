import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../theme/tokens';
import { formatMessageTime } from '../utils/formatters';

interface ChatBubbleProps {
  text: string;
  isMine: boolean;
  timestamp: string;
  isRead?: boolean;
}

/**
 * Chat message bubble with sent/received styling.
 */
function ChatBubbleComponent({
  text,
  isMine,
  timestamp,
  isRead = false,
}: ChatBubbleProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        isMine ? styles.containerMine : styles.containerOther,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isMine
            ? [styles.bubbleMine, { backgroundColor: Colors.primary }]
            : [styles.bubbleOther, { backgroundColor: colors.surfaceElevated }],
        ]}
      >
        <Text
          style={[
            styles.text,
            { color: isMine ? Colors.white : colors.text },
          ]}
        >
          {text}
        </Text>
      </View>
      <View style={[styles.meta, isMine ? styles.metaMine : styles.metaOther]}>
        <Text style={[styles.time, { color: colors.textTertiary }]}>
          {formatMessageTime(timestamp)}
        </Text>
        {isMine && (
          <Text style={[styles.readReceipt, { color: isRead ? Colors.accent : colors.textTertiary }]}>
            {isRead ? '✓✓' : '✓'}
          </Text>
        )}
      </View>
    </View>
  );
}

export const ChatBubble = memo(ChatBubbleComponent);

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.xxs,
    paddingHorizontal: Spacing.base,
    maxWidth: '80%',
  },
  containerMine: {
    alignSelf: 'flex-end',
  },
  containerOther: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  bubbleMine: {
    borderRadius: Radii.lg,
    borderBottomRightRadius: Radii.xs,
  },
  bubbleOther: {
    borderRadius: Radii.lg,
    borderBottomLeftRadius: Radii.xs,
  },
  text: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.base,
    lineHeight: Typography.lineHeight.base,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xxs,
    gap: Spacing.xs,
  },
  metaMine: {
    justifyContent: 'flex-end',
  },
  metaOther: {
    justifyContent: 'flex-start',
  },
  time: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.xs,
  },
  readReceipt: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.size.xs,
  },
});
