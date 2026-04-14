import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import StoryCircle from './StoryCircle';
import { useTheme } from '../theme/ThemeProvider';
import { Spacing } from '../theme/tokens';

interface StoryUser {
  id: string;
  username: string;
  avatar_url: string;
  has_unseen: boolean;
}

interface StoryRowProps {
  stories: StoryUser[];
  currentUserId: string;
  currentUserAvatar: string;
  hasOwnStory: boolean;
  onStoryPress: (userId: string) => void;
  onCreateStory: () => void;
}

/**
 * Horizontal scrolling story row with current user's "Your Story" as first item.
 */
export default function StoryRow({
  stories,
  currentUserId,
  currentUserAvatar,
  hasOwnStory,
  onStoryPress,
  onCreateStory,
}: StoryRowProps) {
  const { colors } = useTheme();

  const handlePress = (userId: string) => {
    if (userId === currentUserId && !hasOwnStory) {
      onCreateStory();
    } else {
      onStoryPress(userId);
    }
  };

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      <FlatList
        data={[
          {
            id: currentUserId,
            username: 'Your Story',
            avatar_url: currentUserAvatar,
            has_unseen: hasOwnStory,
          },
          ...stories,
        ]}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <StoryCircle
            userId={item.id}
            username={item.username}
            avatarUrl={item.avatar_url}
            hasUnseen={item.has_unseen}
            isOwnStory={index === 0}
            onPress={handlePress}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 0.5,
    paddingVertical: Spacing.sm,
  },
  list: {
    paddingHorizontal: Spacing.base,
  },
});
