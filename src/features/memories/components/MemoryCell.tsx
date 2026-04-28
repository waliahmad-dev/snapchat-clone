import React, { useEffect, useState } from 'react';
import { View, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import type Memory from '@lib/watermelondb/models/Memory';
import { SCREEN_WIDTH, MEMORIES_GRID_COLUMNS } from '@constants/dimensions';
import { useThemeColors } from '@lib/theme/useThemeColors';
import { thumbCacheKey } from '@features/memories/lib/memoryImageCache';

const CELL_WIDTH = (SCREEN_WIDTH - (MEMORIES_GRID_COLUMNS + 1) * 2) / MEMORIES_GRID_COLUMNS;
const CELL_HEIGHT = (CELL_WIDTH * 16) / 9;

interface Props {
  memory: Memory;
  getUrl: (memory: Memory) => Promise<string>;
  onPress: (memory: Memory) => void;
  onLongPress: (memory: Memory) => void;
}

export function MemoryCell({ memory, getUrl, onPress, onLongPress }: Props) {
  const c = useThemeColors();
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    getUrl(memory).then(setUri).catch(() => {});
  }, [memory.id, memory.uploadStatus]);

  const isPending = memory.uploadStatus === 'pending' || memory.uploadStatus === 'uploading';

  return (
    <Pressable
      onPress={() => onPress(memory)}
      onLongPress={() => onLongPress(memory)}
      style={[styles.cell, { backgroundColor: c.surfaceElevated }]}>
      {uri ? (
        <Image
          source={{ uri, cacheKey: thumbCacheKey(memory) }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={120}
          recyclingKey={memory.id}
        />
      ) : (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: c.surfaceElevated }]}
        />
      )}
      {isPending && (
        <View style={[StyleSheet.absoluteFill, styles.uploadOverlay]}>
          <ActivityIndicator color="#FFFFFF" size="small" />
          <Text style={{ color: '#FFFFFF', fontSize: 12, marginTop: 4 }}>
            {memory.uploadStatus === 'uploading' ? 'Uploading…' : 'Pending'}
          </Text>
        </View>
      )}
      {memory.uploadStatus === 'failed' && (
        <View style={[StyleSheet.absoluteFill, styles.uploadOverlay]}>
          <Text className="text-2xl">⚠️</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    margin: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  uploadOverlay: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
