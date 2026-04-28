import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { StoryGroup } from '../hooks/useStories';
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  group: StoryGroup;
  onPress: (group: StoryGroup) => void;
  size?: number;
}

export function StoryRing({ group, onPress, size = 64 }: Props) {
  const c = useThemeColors();
  const ringColor = group.hasUnviewed ? c.accent : c.border;
  const innerSize = size - 8;

  return (
    <Pressable onPress={() => onPress(group)} className="items-center mr-4">
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: ringColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <View
          style={{
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: c.surfaceElevated,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text
            style={{
              fontSize: innerSize * 0.45,
              fontWeight: 'bold',
              color: c.textPrimary,
            }}>
            {group.user.display_name[0].toUpperCase()}
          </Text>
        </View>
      </View>
      <Text
        className="text-xs mt-1"
        numberOfLines={1}
        style={{ maxWidth: size, color: c.textPrimary }}>
        {group.user.display_name}
      </Text>
    </Pressable>
  );
}
