import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import CommentsPanel from '../../src/components/comments/CommentsPanel';

export default function CommentsScreen() {
  const { contentType, contentId } = useLocalSearchParams<{ contentType: string; contentId: string }>();
  const router = useRouter();

  if (!contentId) return null;

  return (
    <CommentsPanel
      contentType={(contentType as 'post' | 'reel') || 'post'}
      contentId={contentId}
      onClose={() => router.back()}
      headerMode="screen"
    />
  );
}
