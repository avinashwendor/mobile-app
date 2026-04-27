import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, HitSlop } from '../../../src/theme/tokens';
import { PostCard } from '../../../src/components/PostCard';
import CommentsSheet from '../../../src/components/comments/CommentsSheet';
import ShareSheet from '../../../src/components/ShareSheet';
import * as postApi from '../../../src/api/post.api';
import type { Post } from '../../../src/api/post.api';

export default function PostDetailScreen() {
  const params = useLocalSearchParams<{ id: string; openComments?: string | string[]; commentId?: string | string[] }>();
  const id = params.id;
  const openCommentsParam = Array.isArray(params.openComments) ? params.openComments[0] : params.openComments;
  const highlightCommentId = Array.isArray(params.commentId) ? params.commentId[0] : params.commentId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCommentsOpen, setIsCommentsOpen] = useState(openCommentsParam === '1');
  const [isShareOpen, setIsShareOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const p = await postApi.getPost(id);
        setPost(p);
      } catch (err) {
        console.error('Failed to load post:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (openCommentsParam === '1') {
      setIsCommentsOpen(true);
    }
  }, [openCommentsParam]);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Ionicons name="image-outline" size={48} color={colors.textTertiary} />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>Post not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={HitSlop.md}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Post</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <PostCard
          post={post}
          onComment={(_postId) => setIsCommentsOpen(true)}
          onShare={() => setIsShareOpen(true)}
          onUserPress={(uname) => router.push({ pathname: '/(screens)/user/[id]', params: { id: uname } })}
          onPostPress={() => {}}
        />
      </ScrollView>

      <CommentsSheet
        visible={isCommentsOpen}
        contentType="post"
        contentId={post._id}
        onClose={() => setIsCommentsOpen(false)}
        initialExpanded={false}
        highlightCommentId={highlightCommentId}
      />

      <ShareSheet
        visible={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        contentType="post"
        contentId={post._id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  errorText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, borderBottomWidth: 0.5 },
  headerTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },
});
