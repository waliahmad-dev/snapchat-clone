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
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function StoriesFeedScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const { storyGroups, loading, recordView } = useStories();
  const [activeGroup, setActiveGroup] = useState<StoryGroup | null>(null);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.bg }} edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-2xl" style={{ color: c.textPrimary }}>
            ‹
          </Text>
        </Pressable>
        <Text className="font-bold text-xl tracking-tight" style={{ color: c.textPrimary }}>
          Stories
        </Text>
        <Pressable
          onPress={() => router.push('/(app)/search')}
          className="w-9 h-9 rounded-full items-center justify-center"
          style={{ backgroundColor: c.iconCircleBg }}
          hitSlop={8}>
          <Text className="text-base" style={{ color: c.textPrimary }}>
            🔍
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.accent} />
        </View>
      ) : storyGroups.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-5xl mb-4">📸</Text>
          <Text className="text-xl font-bold mb-2" style={{ color: c.textPrimary }}>
            No stories yet
          </Text>
          <Text className="text-sm text-center" style={{ color: c.textSecondary }}>
            Post your first story or add friends to see theirs.
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="rounded-full px-8 py-3 mt-6"
            style={{ backgroundColor: c.accent }}>
            <Text className="font-bold" style={{ color: c.accentText }}>
              Open Camera
            </Text>
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

          <View className="h-px mx-4" style={{ backgroundColor: c.divider }} />

          <View className="px-4 pt-4 pb-10">
            <Text
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: c.textSecondary }}>
              Recent
            </Text>
            {storyGroups.map((group) => (
              <Pressable
                key={group.user.id}
                onPress={() => setActiveGroup(group)}
                className="flex-row items-center py-3 border-b"
                style={{ borderColor: c.divider }}>
                <StoryRing group={group} onPress={setActiveGroup} size={48} />
                <View className="flex-1 ml-3">
                  <Text className="font-semibold" style={{ color: c.textPrimary }}>
                    {group.user.display_name}
                  </Text>
                  <Text className="text-sm" style={{ color: c.textSecondary }}>
                    {group.stories.length} {group.stories.length === 1 ? 'story' : 'stories'}
                    {group.hasUnviewed && (
                      <Text style={{ color: c.accent }}> · New</Text>
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
