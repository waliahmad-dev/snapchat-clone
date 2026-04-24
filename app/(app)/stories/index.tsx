import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useStories, type StoryGroup } from '@features/stories/hooks/useStories';
import { StoryRing } from '@features/stories/components/StoryRing';
import { StoryViewer } from '@features/stories/components/StoryViewer';

export default function StoriesFeedScreen() {
  const router = useRouter();
  const { storyGroups, loading, recordView } = useStories();
  const [activeGroup, setActiveGroup] = useState<StoryGroup | null>(null);

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-white text-2xl">‹</Text>
        </Pressable>
        <Text className="text-white font-bold text-xl tracking-tight">Stories</Text>
        <Pressable
          onPress={() => router.push('/(app)/search')}
          className="w-9 h-9 bg-white/10 rounded-full items-center justify-center"
          hitSlop={8}>
          <Text className="text-white text-base">🔍</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FFFC00" />
        </View>
      ) : storyGroups.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-white text-5xl mb-4">📸</Text>
          <Text className="text-white text-xl font-bold mb-2">No stories yet</Text>
          <Text className="text-snap-gray text-sm text-center">
            Post your first story or add friends to see theirs.
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="bg-snap-yellow rounded-full px-8 py-3 mt-6">
            <Text className="text-black font-bold">Open Camera</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 16 }}>
            {storyGroups.map((group) => (
              <StoryRing key={group.user.id} group={group} onPress={setActiveGroup} />
            ))}
          </ScrollView>

          <View className="h-px bg-white/10 mx-4" />

          <View className="px-4 pt-4 pb-10">
            <Text className="text-snap-gray text-xs font-semibold uppercase tracking-widest mb-3">
              Recent
            </Text>
            {storyGroups.map((group) => (
              <Pressable
                key={group.user.id}
                onPress={() => setActiveGroup(group)}
                className="flex-row items-center py-3 border-b border-white/5">
                <StoryRing group={group} onPress={setActiveGroup} size={48} />
                <View className="flex-1 ml-3">
                  <Text className="text-white font-semibold">{group.user.display_name}</Text>
                  <Text className="text-snap-gray text-sm">
                    {group.stories.length} {group.stories.length === 1 ? 'story' : 'stories'}
                    {group.hasUnviewed && (
                      <Text className="text-snap-yellow"> · New</Text>
                    )}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      {activeGroup && (
        <Modal visible animationType="none" presentationStyle="fullScreen" statusBarTranslucent>
          <SafeAreaProvider>
            <StoryViewer
              storyGroup={activeGroup}
              onClose={() => setActiveGroup(null)}
              onRecordView={recordView}
            />
          </SafeAreaProvider>
        </Modal>
      )}
    </SafeAreaView>
  );
}
