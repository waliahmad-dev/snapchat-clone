import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { StoryGroup } from '../hooks/useStories';

interface Props {
  group: StoryGroup;
  onPress: (group: StoryGroup) => void;
  size?: number;
}

export function StoryRing({ group, onPress, size = 64 }: Props) {
  const ringColor = group.hasUnviewed ? '#FFFC00' : '#3A3A3A';
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
            backgroundColor: '#1A1A1A',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text
            style={{ fontSize: innerSize * 0.45, fontWeight: 'bold', color: '#fff' }}>
            {group.user.display_name[0].toUpperCase()}
          </Text>
        </View>
      </View>
      <Text className="text-white text-xs mt-1" numberOfLines={1} style={{ maxWidth: size }}>
        {group.user.display_name}
      </Text>
    </Pressable>
  );
}
