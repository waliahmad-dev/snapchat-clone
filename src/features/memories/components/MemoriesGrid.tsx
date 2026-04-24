import React from 'react';
import { View, Text } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { MemoryCell } from './MemoryCell';
import type Memory from '@lib/watermelondb/models/Memory';
import { MEMORIES_GRID_COLUMNS } from '@constants/dimensions';

interface Props {
  memories: Memory[];
  getUrl: (memory: Memory) => Promise<string>;
  onPress: (memory: Memory) => void;
  onLongPress: (memory: Memory) => void;
}

export function MemoriesGrid({ memories, getUrl, onPress, onLongPress }: Props) {
  if (memories.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-white text-5xl mb-4">🌟</Text>
        <Text className="text-white text-xl font-bold mb-2">No memories yet</Text>
        <Text className="text-snap-gray text-center">
          Take snaps and save them here. They'll last forever!
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      data={memories}
      numColumns={MEMORIES_GRID_COLUMNS}
      renderItem={({ item }) => (
        <MemoryCell
          memory={item}
          getUrl={getUrl}
          onPress={onPress}
          onLongPress={onLongPress}
        />
      )}
      contentContainerStyle={{ paddingBottom: 20 }}
    />
  );
}
