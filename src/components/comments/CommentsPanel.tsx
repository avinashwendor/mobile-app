import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, Pressable, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Share, Alert, Keyboard, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../theme/tokens';
import UserAvatar from '../UserAvatar';
import * as commentApi from '../../api/comment.api';
import * as likeApi from '../../api/like.api';
import * as userApi from '../../api/user.api';
import { useAuthStore } from '../../stores/authStore';
import { socketService } from '../../services/socketService';
import { timeAgo, compactNumber } from '../../utils/formatters';
import { mapComment } from '../../api/adapters';
import { buildContentShareMessage } from '../../utils/contentLinks';
import type { Comment } from '../../api/comment.api';

type HeaderMode = 'screen' | 'sheet' | 'none';

interface CommentsPanelProps {
  contentType: 'post' | 'reel';
  contentId: string;
  onClose?: () => void;
  headerMode?: HeaderMode;
  highlightCommentId?: string;
}

type TreeUpdate = {
  comments: Comment[];
  changed: boolean;
};

const MAX_NESTING = 4;
const INDENT_WIDTH = 18;

function findCommentInTree(comments: Comment[], commentId: string): Comment | null {
  for (const comment of comments) {
    if (comment._id === commentId) return comment;
    if (comment.replies?.length) {
      const nested = findCommentInTree(comment.replies, commentId);
      if (nested) return nested;
    }
  }
  return null;
}

function updateCommentTree(
  comments: Comment[],
  commentId: string,
  updater: (comment: Comment) => Comment,
): TreeUpdate {
  let changed = false;
  const next = comments.map((comment) => {
    if (comment._id === commentId) {
      changed = true;
      return updater(comment);
    }
    if (comment.replies?.length) {
      const nested = updateCommentTree(comment.replies, commentId, updater);
      if (nested.changed) {
        changed = true;
        return { ...comment, replies: nested.comments };
      }
    }
    return comment;
  });
  return { comments: next, changed };
}

function upsertCommentTree(comments: Comment[], incoming: Comment): TreeUpdate {
  let changed = false;
  const next = comments.map((comment) => {
    if (comment._id === incoming._id) {
      changed = true;
      return { ...comment, ...incoming, replies: incoming.replies ?? comment.replies };
    }

    if (incoming.parentComment && comment._id === incoming.parentComment) {
      const currentReplies = comment.replies ?? [];
      const replyExists = currentReplies.some((reply) => reply._id === incoming._id);
      const replies = replyExists
        ? currentReplies.map((reply) => (
            reply._id === incoming._id
              ? { ...reply, ...incoming, replies: incoming.replies ?? reply.replies }
              : reply
          ))
        : [...currentReplies, incoming];

      changed = true;
      return {
        ...comment,
        replies,
        repliesCount: replyExists ? Math.max(comment.repliesCount, replies.length) : comment.repliesCount + 1,
      };
    }

    if (comment.replies?.length) {
      const nested = upsertCommentTree(comment.replies, incoming);
      if (nested.changed) {
        changed = true;
        return { ...comment, replies: nested.comments };
      }
    }

    return comment;
  });

  if (!incoming.parentComment) {
    if (changed) return { comments: next, changed: true };
    return { comments: [incoming, ...next], changed: true };
  }

  return { comments: next, changed };
}

function replaceRepliesInTree(comments: Comment[], commentId: string, replies: Comment[]): TreeUpdate {
  return updateCommentTree(comments, commentId, (comment) => ({
    ...comment,
    replies,
    repliesCount: Math.max(comment.repliesCount, replies.length),
  }));
}

function removeCommentFromTree(comments: Comment[], commentId: string): { comments: Comment[]; removed: Comment | null } {
  const next: Comment[] = [];
  let removed: Comment | null = null;

  for (const comment of comments) {
    if (comment._id === commentId) {
      removed = comment;
      continue;
    }

    if (comment.replies?.length) {
      const nested = removeCommentFromTree(comment.replies, commentId);
      if (nested.removed) {
        removed = nested.removed;
        next.push({
          ...comment,
          replies: nested.comments,
          repliesCount: nested.removed.parentComment === comment._id
            ? Math.max(0, comment.repliesCount - 1)
            : comment.repliesCount,
        });
        continue;
      }
    }

    next.push(comment);
  }

  return { comments: next, removed };
}

function isSameContent(
  payload: { content_type?: string; content_id?: string | number | null; contentType?: string; contentId?: string | number | null },
  contentType: 'post' | 'reel',
  contentId: string,
): boolean {
  const payloadType = String(payload.content_type ?? payload.contentType ?? '');
  const payloadId = String(payload.content_id ?? payload.contentId ?? '');
  return payloadType === contentType && payloadId === contentId;
}

export default function CommentsPanel({
  contentType,
  contentId,
  onClose,
  headerMode = 'screen',
  highlightCommentId,
}: CommentsPanelProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<Comment>>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [inputSelection, setInputSelection] = useState({ start: 0, end: 0 });
  const [isSending, setIsSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  const [mentionCandidates, setMentionCandidates] = useState<userApi.UserSearchResult[]>([]);

  const fetchComments = useCallback(async (nextPage: number, refresh = false) => {
    try {
      const result = await commentApi.getComments(contentType, contentId, nextPage, 20);
      setComments((prev) => {
        if (refresh) return result.comments;
        const existingIds = new Set(prev.map((comment) => comment._id));
        return [...prev, ...result.comments.filter((comment) => !existingIds.has(comment._id))];
      });
      setHasMore(result.hasMore);
      setPage(nextPage);
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  }, [contentId, contentType]);

  const loadReplies = useCallback(async (commentId: string) => {
    const existingComment = findCommentInTree(comments, commentId);
    if (!existingComment) return;

    if (expandedReplies.has(commentId)) {
      setExpandedReplies((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
      return;
    }

    if (existingComment.replies) {
      setExpandedReplies((prev) => new Set(prev).add(commentId));
      return;
    }

    setLoadingReplies((prev) => new Set(prev).add(commentId));
    try {
      const result = await commentApi.getCommentReplies(commentId, 1, 20);
      setComments((prev) => replaceRepliesInTree(prev, commentId, result.replies).comments);
      setExpandedReplies((prev) => new Set(prev).add(commentId));
    } catch (error) {
      console.error('Failed to load replies:', error);
    } finally {
      setLoadingReplies((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    }
  }, [comments, expandedReplies]);

  useEffect(() => {
    if (!contentId) return;
    setComments([]);
    setPage(1);
    setHasMore(true);
    setExpandedReplies(new Set());
    setLoadingReplies(new Set());
    setIsLoading(true);
    fetchComments(1, true).finally(() => setIsLoading(false));
  }, [contentId, contentType, fetchComments]);

  useEffect(() => {
    if (!user?._id) return;

    let cancelled = false;

    Promise.all([
      userApi.getUserFollowers(user._id, 1, 100).catch(() => ({ followers: [], hasMore: false })),
      userApi.getUserFollowing(user._id, 1, 100).catch(() => ({ following: [], hasMore: false })),
    ]).then(([followersResult, followingResult]) => {
      if (cancelled) return;

      const seen = new Set<string>();
      const merged = [...followersResult.followers, ...followingResult.following].filter((candidate) => {
        if (!candidate?._id || seen.has(candidate._id)) return false;
        seen.add(candidate._id);
        return true;
      });

      setMentionCandidates(merged);
    });

    return () => {
      cancelled = true;
    };
  }, [user?._id]);

  useEffect(() => {
    if (!contentId) return;

    socketService.joinContent(contentType, contentId);

    const unsubscribers = [
      socketService.on('comment_created', (payload) => {
        const incoming = payload?.comment ? mapComment(payload.comment) : null;
        if (!incoming || incoming.contentType !== contentType || incoming.contentId !== contentId) return;

        setComments((prev) => upsertCommentTree(prev, incoming).comments);
        if (incoming.parentComment) {
          setExpandedReplies((prev) => new Set(prev).add(incoming.parentComment as string));
        }
      }),
      socketService.on('comment_deleted', (payload) => {
        if (!isSameContent(payload ?? {}, contentType, contentId)) return;
        const removedId = String(payload?.comment_id ?? '');
        if (!removedId) return;
        setComments((prev) => removeCommentFromTree(prev, removedId).comments);
      }),
      socketService.on('comment_liked', (payload) => {
        if (!isSameContent(payload ?? {}, contentType, contentId)) return;
        const commentIdFromEvent = String(payload?.comment_id ?? '');
        if (!commentIdFromEvent) return;
        const likesCount = Number(payload?.likes_count ?? 0);
        setComments((prev) => updateCommentTree(prev, commentIdFromEvent, (comment) => ({
          ...comment,
          likesCount,
        })).comments);
      }),
      socketService.on('comment_unliked', (payload) => {
        if (!isSameContent(payload ?? {}, contentType, contentId)) return;
        const commentIdFromEvent = String(payload?.comment_id ?? '');
        if (!commentIdFromEvent) return;
        const likesCount = Number(payload?.likes_count ?? 0);
        setComments((prev) => updateCommentTree(prev, commentIdFromEvent, (comment) => ({
          ...comment,
          likesCount,
        })).comments);
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      socketService.leaveContent(contentType, contentId);
    };
  }, [contentId, contentType]);

  useEffect(() => {
    if (!highlightCommentId || comments.length === 0) return;
    const topLevelIndex = comments.findIndex((comment) => comment._id === highlightCommentId);

    if (topLevelIndex >= 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index: topLevelIndex, animated: true });
      });
      return;
    }

    let cancelled = false;

    (async () => {
      for (const parentComment of comments) {
        if (cancelled || parentComment.repliesCount <= 0) break;

        const replies = parentComment.replies
          ?? (await commentApi.getCommentReplies(parentComment._id, 1, 20).then((result) => result.replies).catch(() => []));

        if (cancelled || replies.length === 0) continue;

        if (!parentComment.replies) {
          setComments((prev) => replaceRepliesInTree(prev, parentComment._id, replies).comments);
        }

        if (replies.some((reply) => reply._id === highlightCommentId)) {
          setExpandedReplies((prev) => new Set(prev).add(parentComment._id));

          const parentIndex = comments.findIndex((comment) => comment._id === parentComment._id);
          if (parentIndex >= 0) {
            requestAnimationFrame(() => {
              listRef.current?.scrollToIndex({ index: parentIndex, animated: true });
            });
          }
          break;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [comments, highlightCommentId]);

  const activeMention = useMemo(() => {
    const cursor = inputSelection.start;
    const beforeCursor = newComment.slice(0, cursor);
    const match = beforeCursor.match(/(?:^|\s)@([a-z0-9_]*)$/i);

    if (!match) return null;

    return {
      query: match[1].toLowerCase(),
      rangeStart: beforeCursor.lastIndexOf('@'),
      rangeEnd: cursor,
    };
  }, [inputSelection.start, newComment]);

  const mentionSuggestions = useMemo(() => {
    if (!activeMention) return [];

    return mentionCandidates
      .filter((candidate) => {
        if (!activeMention.query) return true;

        const username = candidate.username.toLowerCase();
        const fullName = candidate.fullName.toLowerCase();
        return username.includes(activeMention.query) || fullName.includes(activeMention.query);
      })
      .slice(0, 6);
  }, [activeMention, mentionCandidates]);

  const keyboardOffset = useMemo(() => {
    if (headerMode !== 'screen') return 0;
    return insets.top + 56;
  }, [headerMode, insets.top]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, (event: any) => {
      const windowHeight = Dimensions.get('window').height;
      const eventHeight = event?.endCoordinates?.height ?? 0;
      const screenY = event?.endCoordinates?.screenY ?? windowHeight;
      const derivedHeight = Math.max(0, windowHeight - screenY);
      setKeyboardHeight(Math.max(eventHeight, derivedHeight));
    });

    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  const handleSend = useCallback(async () => {
    if (!newComment.trim() || isSending) return;
    setIsSending(true);
    try {
      const comment = await commentApi.createComment({
        content: newComment.trim(),
        contentType,
        contentId,
        parentComment: replyTo?.id,
      });
      setComments((prev) => upsertCommentTree(prev, comment).comments);
      if (replyTo?.id) {
        setExpandedReplies((prev) => new Set(prev).add(replyTo.id));
      }
      setNewComment('');
      setInputSelection({ start: 0, end: 0 });
      setReplyTo(null);
    } catch (error) {
      console.error('Failed to send comment:', error);
    } finally {
      setIsSending(false);
    }
  }, [contentId, contentType, isSending, newComment, replyTo]);

  const handleLikeComment = useCallback(async (commentId: string) => {
    const target = findCommentInTree(comments, commentId);
    if (!target) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const wasLiked = target.isLiked;
    setComments((prev) => updateCommentTree(prev, commentId, (comment) => ({
      ...comment,
      isLiked: !wasLiked,
      likesCount: comment.likesCount + (wasLiked ? -1 : 1),
    })).comments);

    try {
      if (wasLiked) {
        await likeApi.unlikeContent('comment', commentId);
      } else {
        await likeApi.likeContent('comment', commentId);
      }
    } catch (error) {
      console.error('Failed to toggle comment like:', error);
      setComments((prev) => updateCommentTree(prev, commentId, (comment) => ({
        ...comment,
        isLiked: wasLiked,
        likesCount: comment.likesCount + (wasLiked ? 1 : -1),
      })).comments);
    }
  }, [comments]);

  const handleReply = useCallback((commentId: string, username: string) => {
    setReplyTo({ id: commentId, username });
    inputRef.current?.focus();
  }, []);

  const insertMention = useCallback((candidate: userApi.UserSearchResult) => {
    if (!activeMention) return;

    const prefix = newComment.slice(0, activeMention.rangeStart);
    const suffix = newComment.slice(activeMention.rangeEnd);
    const mentionText = `@${candidate.username} `;
    const nextValue = `${prefix}${mentionText}${suffix}`;
    const nextCursor = prefix.length + mentionText.length;

    setNewComment(nextValue);
    setInputSelection({ start: nextCursor, end: nextCursor });
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [activeMention, newComment]);

  const handleShareComment = useCallback(async (comment: Comment) => {
    try {
      await Share.share({
        message: buildContentShareMessage({
          contentType,
          contentId,
          commentId: comment._id,
          openComments: true,
          headline: `${comment.author.username}: "${comment.content}"`,
        }),
      });
    } catch {
      // noop
    }
  }, [contentId, contentType]);

  const handleDeleteComment = useCallback((commentId: string) => {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await commentApi.deleteComment(commentId);
            setComments((prev) => removeCommentFromTree(prev, commentId).comments);
          } catch (error) {
            console.error('Failed to delete comment:', error);
          }
        },
      },
    ]);
  }, []);

  const headerIcon = useMemo(() => {
    if (headerMode === 'sheet') return 'chevron-down';
    if (headerMode === 'screen') return 'arrow-back';
    return null;
  }, [headerMode]);

  const renderCommentNode = useCallback((comment: Comment, depth = 0) => {
    const leftInset = Math.min(depth, MAX_NESTING) * INDENT_WIDTH;
    const isOwn = comment.author._id === user?._id;
    const isExpanded = expandedReplies.has(comment._id);
    const isLoadingReply = loadingReplies.has(comment._id);
    const isHighlighted = comment._id === highlightCommentId;

    return (
      <Animated.View key={comment._id} entering={depth === 0 ? FadeIn.duration(180) : FadeInDown.duration(180)}>
        <View style={[
          styles.commentRow,
          { paddingLeft: Spacing.base + leftInset },
          isHighlighted && { backgroundColor: colors.surfaceElevated },
        ]}>
          <Pressable onPress={() => router.push({ pathname: '/(screens)/user/[id]', params: { id: comment.author.username } })}>
            <UserAvatar uri={comment.author.profilePicture} size={depth === 0 ? 'sm' : 'xs'} />
          </Pressable>

          <View style={styles.commentContent}>
            <Text style={[styles.commentText, { color: colors.text }]}>
              <Text style={styles.commentUsername}>{comment.author.username}</Text>
              {comment.author.isVerified && <Text style={{ color: Colors.accent }}> ✓</Text>}
              {'  '}{comment.content}
            </Text>

            <View style={styles.commentMeta}>
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>{timeAgo(comment.createdAt)}</Text>
              {comment.likesCount > 0 && (
                <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                  {compactNumber(comment.likesCount)} likes
                </Text>
              )}
              <Pressable onPress={() => handleReply(comment._id, comment.author.username)}>
                <Text style={[styles.replyBtnText, { color: colors.textTertiary }]}>Reply</Text>
              </Pressable>
              <Pressable onPress={() => handleShareComment(comment)} hitSlop={HitSlop.sm}>
                <Ionicons name="paper-plane-outline" size={12} color={colors.textTertiary} />
              </Pressable>
              {isOwn && (
                <Pressable onPress={() => handleDeleteComment(comment._id)} hitSlop={HitSlop.sm}>
                  <Ionicons name="trash-outline" size={12} color={colors.textTertiary} />
                </Pressable>
              )}
            </View>
          </View>

          <Pressable onPress={() => handleLikeComment(comment._id)} hitSlop={HitSlop.md} style={styles.likeBtn}>
            <Ionicons
              name={comment.isLiked ? 'heart' : 'heart-outline'}
              size={depth === 0 ? 14 : 12}
              color={comment.isLiked ? Colors.likeFilled : colors.textTertiary}
            />
          </Pressable>
        </View>

        {comment.repliesCount > 0 && (
          <View style={[styles.repliesSection, { paddingLeft: Spacing.base + leftInset + 32 + Spacing.sm }]}> 
            <Pressable onPress={() => loadReplies(comment._id)} style={styles.viewRepliesBtn}>
              <View style={[styles.repliesLine, { backgroundColor: colors.textTertiary }]} />
              {isLoadingReply ? (
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: Spacing.sm }} />
              ) : (
                <Text style={[styles.viewRepliesText, { color: colors.textTertiary }]}>
                  {isExpanded ? 'Hide replies' : `View ${comment.repliesCount} ${comment.repliesCount === 1 ? 'reply' : 'replies'}`}
                </Text>
              )}
            </Pressable>

            {isExpanded && comment.replies?.map((reply) => renderCommentNode(reply, depth + 1))}
          </View>
        )}
      </Animated.View>
    );
  }, [colors, expandedReplies, handleDeleteComment, handleLikeComment, handleReply, handleShareComment, highlightCommentId, loadReplies, loadingReplies, router, user]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}> 
      {headerMode !== 'none' && (
        <View style={[
          styles.header,
          {
            paddingTop: headerMode === 'screen' ? insets.top + Spacing.sm : Spacing.sm,
            borderBottomColor: colors.border,
          },
        ]}>
          {headerIcon ? (
            <Pressable onPress={onClose} hitSlop={HitSlop.md}>
              <Ionicons name={headerIcon} size={24} color={colors.text} />
            </Pressable>
          ) : <View style={{ width: 24 }} />}
          <Text style={[styles.headerTitle, { color: colors.text }]}>Comments</Text>
          <Pressable onPress={() => Share.share({ message: buildContentShareMessage({ contentType, contentId }) })} hitSlop={HitSlop.md}>
            <Ionicons name="paper-plane-outline" size={22} color={colors.text} />
          </Pressable>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={comments}
          renderItem={({ item }) => renderCommentNode(item, 0)}
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? keyboardOffset : 0}
      >
        <View style={[
          styles.inputBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom || Spacing.sm, keyboardHeight + Spacing.xs),
          },
        ]}>
          {mentionSuggestions.length > 0 && (
            <View style={[styles.mentionPanel, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}> 
              {mentionSuggestions.map((candidate) => (
                <Pressable key={candidate._id} style={styles.mentionRow} onPress={() => insertMention(candidate)}>
                  <UserAvatar uri={candidate.profilePicture} size="xs" />
                  <View style={styles.mentionTextWrap}>
                    <Text style={[styles.mentionUsername, { color: colors.text }]}>@{candidate.username}</Text>
                    <Text style={[styles.mentionFullName, { color: colors.textSecondary }]} numberOfLines={1}>{candidate.fullName}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

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
                onChangeText={(text) => {
                  setNewComment(text);
                  if (inputSelection.start > text.length) {
                    setInputSelection({ start: text.length, end: text.length });
                  }
                }}
                onSelectionChange={(event) => setInputSelection(event.nativeEvent.selection)}
                placeholder={replyTo ? `Reply to @${replyTo.username}...` : 'Add a comment...'}
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.text }]}
                multiline
                maxLength={1000}
                selection={inputSelection}
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
  commentRow: { flexDirection: 'row', paddingRight: Spacing.base, paddingVertical: Spacing.sm, borderRadius: Radii.md },
  commentContent: { flex: 1, marginLeft: Spacing.sm },
  commentText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, lineHeight: 20 },
  commentUsername: { fontFamily: Typography.fontFamily.semiBold },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: 6, flexWrap: 'wrap' },
  metaText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },
  replyBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.xs },
  likeBtn: { paddingLeft: Spacing.sm, paddingTop: Spacing.xs },
  repliesSection: { paddingBottom: Spacing.xs },
  viewRepliesBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs },
  repliesLine: { width: 24, height: 0.5 },
  viewRepliesText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.xs, marginLeft: Spacing.sm },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.lg },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm },
  inputBar: { borderTopWidth: 0.5, paddingHorizontal: Spacing.base, paddingTop: Spacing.sm },
  mentionPanel: { borderWidth: 1, borderRadius: Radii.lg, marginBottom: Spacing.sm, overflow: 'hidden' },
  mentionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  mentionTextWrap: { flex: 1 },
  mentionUsername: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  mentionFullName: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, marginTop: 2 },
  replyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: Spacing.sm, marginBottom: Spacing.xs, borderBottomWidth: 0.5 },
  replyBannerText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', borderRadius: 22, borderWidth: 1, paddingLeft: Spacing.md, paddingRight: 4, minHeight: 44 },
  input: { flex: 1, fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, maxHeight: 100, paddingVertical: Platform.OS === 'ios' ? 12 : 8 },
  sendButton: { padding: 4, marginBottom: Platform.OS === 'ios' ? 4 : 2 },
});