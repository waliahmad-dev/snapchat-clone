import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StoryViewer } from '@features/stories/components/StoryViewer';
import { useStories } from '@features/stories/hooks/useStories';

export default function StoryDetailScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { storyGroups, recordView } = useStories();

  const group = storyGroups.find((g) => g.user.id === userId);

  if (!group) {
    router.back();
    return null;
  }

  return (
    <View className="flex-1 bg-black">
      <StoryViewer
        storyGroup={group}
        onClose={() => router.back()}
        onRecordView={recordView}
      />
    </View>
  );
}
