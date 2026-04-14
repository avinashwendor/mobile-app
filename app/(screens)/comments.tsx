import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, Pressable, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Share, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../src/theme/tokens';
import UserAvatar from '../../src/components/UserAvatar';
import * as commentApi from '../../src/api/comment.api';
import * as likeApi from '../../src/api/like.api';
import { useAuthStore } from '../../src/stores/authStore';
import { timeAgo, compactNumber } from '../../src/utils/formatters';
import type { Comment } from '../../src/api/comment.api';

export default function CommentsScreen() {
  const { contentType, contentId } = useLocalSearchParams<{ contentType: string; contentId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const inputRef = useRef<TextInput>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());

  const cType = (contentType as 'post' | 'reel') || 'post';

  const fetchComments = useCallback(async (p: number, refresh = false) => {
    try {
      const result = await commentApi.getComments(cType, contentId!, p, 20);
      if (refresh) {
        setComments(result.comments);
      } else {
        setComments((prev) => [...prev, ...result.comments]);
      }
      setHasMore(result.hasMore);
      setPage(p);
    } catch (err) {
      console.error('Failed to load comments:', err);
    }
  }, [contentId, cType]);

  useEffect(() => {
    if (contentId) {
      fetchComments(1, true).then(() => setIsLoading(false));
    }
  }, [contentId]);

  const handleSend = useCallback(async () => {
    if (!newComment.trim() || isSending) return;
    setIsSending(true);
    try {
      const comment = await commentApi.createComment({
        content: newComment.trim(),
        contentType: cType,
        contentId: contentId!,
        parentComment: replyTo?.id,
      });
      if (replyTo) {
        setComments((prev) => prev.map((c) =>
          c._id === replyTo.id
            ? { ...c, replies: [...(c.replies || []), comment], repliesCount: c.repliesCount + 1 }
            : c
        ));
        setExpandedReplies((prev) => new Set(prev).add(replyTo.id));
      } else {
        setComments((prev) => [comment, ...prev]);
      }
      setNewComment('');
      setReplyTo(null);
    } catch (err: any) {
      console.error('Failed to send comment:', err);
    } finally {
      setIsSending(false);
    }
  }, [newComment, isSending, cType, contentId, replyTo]);

  const handleLikeComment = useCallback(async (commentId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const wasLiked = likedComments.has(commentId);
    setLikedComments((prev) => {
      const next = new Set(prev);
      wasLiked ? next.delete(commentId) : next.add(commentId);
      return next;
    });
    setComments((prev) => prev.map((c) => {
      if (c._id === commentId) return { ...c, likesCount: c.likesCount + (wasLiked ? -1 : 1) };
      if (c.replies) {
        return { ...c, replies: c.replies.map((r) => r._id === commentId ? { ...r, likesCount: r.likesCount + (wasLiked ? -1 : 1) } : r) };
      }
      return c;
    }));
    try {
      if (wasLiked) {
        await likeApi.unlikeContent('comment', commentId);
      } else {
        await likeApi.likeContent('comment', commentId);
      }
    } catch {
      setLikedComments((prev) => {
        const next = new Set(prev);
        wasLiked ? next.add(commentId) : next.delete(commentId);
        return next;
      });
    }
  }, [likedComments]);

  const handleReply = useCallback((commentId: string, username: string) => {
    setReplyTo({ id: commentId, username });
    inputRef.current?.focus();
  }, []);

  const handleShareComment = useCallback(async (comment: Comment) => {
    try {
      await Share.share({ message: `${comment.author.username}: "${comment.content}"` });
    } catch {}
  }, []);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await commentApi.deleteComment(commentId);
        setComments((prev) => prev.filter((c) => c._id !== commentId));
      }},
    ]);
  }, []);

  const handleLoadReplies = useCallback(async (commentId: string) => {
    if (expandedReplies.has(commentId)) {
      setExpandedReplies((prev) => { const n = new Set(prev); n.delete(commentId); return n; });
      return;
    }
    setLoadingReplies((prev) => new Set(prev).add(commentId));
    try {
      const result = await commentApi.getCommentReplies(commentId);
      setComments((prev) => prev.map((c) =>
        c._id === commentId ? { ...c, replies: result.replies } : c
      ));
      setExpandedReplies((prev) => new Set(prev).add(commentId));
    } catch {}
    setLoadingReplies((prev) => { const n = new Set(prev); n.delete(commentId); return n; });
  }, [expandedReplies]);

  const renderReply = useCallback((reply: Comment) => {
    const isLiked = likedComments.has(reply._id);
    return (
      <Animated.View key={reply._id} entering={FadeInDown.duration(200)} style={styles.replyRow}>
        <Pressable onPress={() => router.push({ pathname: '/(screens)/user/[id]', params: { id: reply.author.username } })}>
          <UserAvatar uri={reply.author.profilePicture} size="xs" />
        </Pressable>
        <View style={styles.commentContent}>
          <Text style={[styles.commentText, { color: colors.text }]}>
            <Text style={styles.commentUsername}>{reply.author.username}</Text>
            {reply.author.isVerified && <Text style={{ color: Colors.accent }}> ✓</Text>}
            {'  '}{reply.content}
          </Text>
          <View style={styles.commentMeta}>
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>{timeAgo(reply.createdAt)}</Text>
            {reply.likesCount > 0 && (
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>{compactNumber(reply.likesCount)} likes</Text>
            )}
            <Pressable onPress={() => handleReply(reply.parentComment || reply._id, reply.author.username)}>
              <Text style={[styles.replyBtnText, { color: colors.textTertiary }]}>Reply</Text>
            </Pressable>
            <Pressable onPress={() => handleShareComment(reply)} hitSlop={HitSlop.sm}>
              <Ionicons name="paper-plane-outline" size={11} color={colors.textTertiary} />
            </Pressable>
          </View>
        </View>
        <Pressable onPress={() => handleLikeComment(reply._id)} hitSlop={HitSlop.md} style={styles.likeBtn}>
          <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={12} color={isLiked ? Colors.likeFilled : colors.textTertiary} />
        </Pressable>
      </Animated.View>
    );
  }, [colors, likedComments]);

  const renderComment = useCallback(({ item }: { item: Comment }) => {
    const isLiked = likedComments.has(item._id);
    const isOwn = item.author._id === user?._id;
    const isExpanded = expandedReplies.has(item._id);
    const isLoadingReply = loadingReplies.has(item._id);

    return (
      <Animated.View entering={FadeIn.duration(200)}>
        <View style={styles.commentRow}>
          <Pressable onPress={() => router.push({ pathname: '/(screens)/user/[id]', params: { id: item.author.username } })}>
            <UserAvatar uri={item.author.profilePicture} size="sm" />
          </Pressable>
          <View style={styles.commentContent}>
            <Text style={[styles.commentText, { color: colors.text }]}>
              <Text style={styles.commentUsername}>{item.author.username}</Text>
              {item.author.isVerified && <Text style={{ color: Colors.accent }}> ✓</Text>}
              {'  '}{item.content}
            </Text>
            <View style={styles.commentMeta}>
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>{timeAgo(item.createdAt)}</Text>
              {item.likesCount > 0 && (
                <Text style={[styles.metaText, { color: colors.textTertiary }]}>{compactNumber(item.likesCount)} likes</Text>
              )}
              <Pressable onPress={() => handleReply(item._id, item.author.username)}>
                <Text style={[styles.replyBtnText, { color: colors.textTertiary }]}>Reply</Text>
              </Pressable>
              <Pressable onPress={() => handleShareComment(item)} hitSlop={HitSlop.sm}>
                <Ionicons name="paper-plane-outline" size={12} color={colors.textTertiary} />
              </Pressable>
              {isOwn && (
                <Pressable onPress={() => handleDeleteComment(item._id)} hitSlop={HitSlop.sm}>
                  <Ionicons name="trash-outline" size={12} color={colors.textTertiary} />
                </Pressable>
              )}
              {item.isPinned && (
                <View style={styles.pinnedBadge}>
                  <Ionicons name="pin" size={10} color={Colors.accent} />
                  <Text style={[styles.pinnedText, { color: Colors.accent }]}>Pinned</Text>
                </View>
              )}
            </View>
          </View>
          <Pressable onPress={() => handleLikeComment(item._id)} hitSlop={HitSlop.md} style={styles.likeBtn}>
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={14} color={isLiked ? Colors.likeFilled : colors.textTertiary} />
          </Pressable>
        </View>

        {item.repliesCount > 0 && (
          <View style={styles.repliesSection}>
            <Pressable onPress={() => handleLoadReplies(item._id)} style={styles.viewRepliesBtn}>
              <View style={[styles.repliesLine, { backgroundColor: colors.textTertiary }]} />
              {isLoadingReply ? (
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: Spacing.sm }} />
              ) : (
                <Text style={[styles.viewRepliesText, { color: colors.textTertiary }]}>
                  {isExpanded ? 'Hide replies' : `View ${item.repliesCount} ${item.repliesCount === 1 ? 'reply' : 'replies'}`}
                </Text>
              )}
            </Pressable>
            {isExpanded && item.replies && item.replies.map((reply) => renderReply(reply))}
          </View>
        )}
      </Animated.View>
    );
  }, [colors, likedComments, expandedReplies, loadingReplies, user]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={HitSlop.md}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Comments</Text>
        <Pressable onPress={() => Share.share({ message: `Check out this ${cType}!` })} hitSlop={HitSlop.md}>
          <Ionicons name="paper-plane-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={comments}
          renderItem={renderComment}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          onEndReached={() => hasMore && fetchComments(page + 1)}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No comments yet</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Start the conversation.</Text>
            </View>
          }
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom || Spacing.sm }]}>
          {replyTo && (
            <View style={[styles.replyBanner, { borderBottomColor: colors.border }]}>
              <Text style={[styles.replyBannerText, { color: colors.textSecondary }]}>
                Replying to <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.semiBold }}>@{replyTo.username}</Text>
              </Text>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={HitSlop.sm}>
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </Pressable>
            </View>
          )}
          <View style={styles.inputRow}>
            <UserAvatar uri={user?.profilePicture} size="sm" />
            <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <TextInput
                ref={inputRef}
                value={newComment}
                onChangeText={setNewComment}
                placeholder={replyTo ? `Reply to @${replyTo.username}...` : 'Add a comment...'}
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.text }]}
                multiline
                maxLength={1000}
              />
              {newComment.trim().length > 0 && (
                <Pressable onPress={handleSend} disabled={isSending} style={styles.sendButton}>
                  {isSending ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Ionicons name="arrow-up-circle" size={30} color={Colors.primary} />
                  )}
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, borderBottomWidth: 0.5 },
  headerTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },
  list: { paddingVertical: Spacing.xs },
  commentRow: { flexDirection: 'row', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  replyRow: { flexDirection: 'row', paddingLeft: Spacing.base + 32 + Spacing.sm, paddingRight: Spacing.base, paddingVertical: Spacing.xs },
  commentContent: { flex: 1, marginLeft: Spacing.sm },
  commentText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, lineHeight: 20 },
  commentUsername: { fontFamily: Typography.fontFamily.semiBold },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: 6 },
  metaText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },
  replyBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.xs },
  likeBtn: { paddingLeft: Spacing.sm, paddingTop: Spacing.xs },
  pinnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  pinnedText: { fontFamily: Typography.fontFamily.medium, fontSize: 10 },
  repliesSection: { paddingLeft: Spacing.base + 32 + Spacing.sm },
  viewRepliesBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs },
  repliesLine: { width: 24, height: 0.5 },
  viewRepliesText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.xs, marginLeft: Spacing.sm },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.lg },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm },
  inputBar: { borderTopWidth: 0.5, paddingHorizontal: Spacing.base, paddingTop: Spacing.sm },
  replyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: Spacing.sm, marginBottom: Spacing.xs, borderBottomWidth: 0.5 },
  replyBannerText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', borderRadius: 22, borderWidth: 1, paddingLeft: Spacing.md, paddingRight: 4, minHeight: 44 },
  input: { flex: 1, fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, maxHeight: 100, paddingVertical: Platform.OS === 'ios' ? 12 : 8 },
  sendButton: { padding: 4, marginBottom: Platform.OS === 'ios' ? 4 : 2 },
});
