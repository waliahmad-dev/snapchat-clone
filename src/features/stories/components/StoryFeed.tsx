import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StoryRing } from './StoryRing';
import type { StoryGroup } from '../hooks/useStories';
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  storyGroups: StoryGroup[];
  onSelectGroup: (group: StoryGroup) => void;
}

export function StoryFeed({ storyGroups, onSelectGroup }: Props) {
  const c = useThemeColors();
  const { t } = useTranslation();

  if (storyGroups.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-5xl mb-4">📖</Text>
        <Text className="text-xl font-bold mb-2" style={{ color: c.textPrimary }}>
          {t('stories.feedEmptyTitle')}
        </Text>
        <Text className="text-center" style={{ color: c.textSecondary }}>
          {t('stories.feedEmptyBody')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-4 py-4 border-b"
        style={{ borderColor: c.border }}>
        {storyGroups.map((group) => (
          <StoryRing key={group.user.id} group={group} onPress={onSelectGroup} />
        ))}
      </ScrollView>

      <View className="px-4 pt-4">
        <Text
          className="text-xs font-semibold uppercase tracking-wide mb-3"
          style={{ color: c.textSecondary }}>
          {t('stories.recentStories')}
        </Text>
        {storyGroups.map((group) => (
          <Pressable
            key={group.user.id}
            onPress={() => onSelectGroup(group)}
            className="flex-row items-center py-3 border-b"
            style={{ borderColor: c.divider }}>
            <StoryRing group={group} onPress={onSelectGroup} size={48} />
            <View className="flex-1 ml-3">
              <Text className="font-semibold" style={{ color: c.textPrimary }}>
                {group.user.display_name}
              </Text>
              <Text className="text-sm" style={{ color: c.textSecondary }}>
                {t('stories.storyCount', { count: group.stories.length })}
                {group.hasUnviewed ? (
                  <Text style={{ color: c.accent }}> · {t('stories.newBadge')}</Text>
                ) : null}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
