import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { StoryRing } from './StoryRing';
import type { StoryGroup } from '../hooks/useStories';

interface Props {
  storyGroups: StoryGroup[];
  onSelectGroup: (group: StoryGroup) => void;
}

export function StoryFeed({ storyGroups, onSelectGroup }: Props) {
  if (storyGroups.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-white text-5xl mb-4">📖</Text>
        <Text className="text-white text-xl font-bold mb-2">No stories yet</Text>
        <Text className="text-snap-gray text-center">
          Add friends or post your own story to see it here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-4 py-4 border-b border-white/10">
        {storyGroups.map((group) => (
          <StoryRing
            key={group.user.id}
            group={group}
            onPress={onSelectGroup}
          />
        ))}
      </ScrollView>

      <View className="px-4 pt-4">
        <Text className="text-snap-gray text-xs font-semibold uppercase tracking-wide mb-3">
          Recent Stories
        </Text>
        {storyGroups.map((group) => (
          <Pressable
            key={group.user.id}
            onPress={() => onSelectGroup(group)}
            className="flex-row items-center py-3 border-b border-white/5">
            <StoryRing group={group} onPress={onSelectGroup} size={48} />
            <View className="flex-1 ml-3">
              <Text className="text-white font-semibold">{group.user.display_name}</Text>
              <Text className="text-snap-gray text-sm">
                {group.stories.length} story{group.stories.length !== 1 ? 's' : ''}
                {group.hasUnviewed ? (
                  <Text className="text-snap-yellow"> · New</Text>
                ) : null}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
