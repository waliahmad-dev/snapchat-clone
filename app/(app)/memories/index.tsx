import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMemories } from '@features/memories/hooks/useMemories';
import { MemoryCell } from '@features/memories/components/MemoryCell';
import { MemoryViewer } from '@features/memories/components/MemoryViewer';
import type Memory from '@lib/watermelondb/models/Memory';
import { MEMORIES_GRID_COLUMNS } from '@constants/dimensions';
import { ScreenHeader } from '@components/ui/ScreenHeader';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function MemoriesScreen() {
  const c = useThemeColors();
  const {
    memories,
    loading,
    getDisplayUrl,
    getFullUrl,
    ensureLocalCopy,
    deleteMemory,
  } = useMemories();

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const handleOpen = useCallback(
    (memory: Memory) => {
      const idx = memories.findIndex((m) => m.id === memory.id);
      if (idx >= 0) setViewerIndex(idx);
    },
    [memories],
  );

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <ScreenHeader title="Memories" />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.accent} />
        </View>
      ) : memories.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="images-outline" size={56} color={c.iconMuted} />
          <Text className="text-lg font-bold mt-4 mb-1" style={{ color: c.textPrimary }}>
            No memories yet
          </Text>
          <Text className="text-sm text-center" style={{ color: c.textSecondary }}>
            Take snaps and save them here. They'll last forever!
          </Text>
        </View>
      ) : (
        <FlatList
          data={memories}
          keyExtractor={(item) => item.id}
          numColumns={MEMORIES_GRID_COLUMNS}
          renderItem={({ item }) => (
            <MemoryCell
              memory={item}
              getUrl={getDisplayUrl}
              onPress={handleOpen}
              onLongPress={handleOpen}
            />
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

      {viewerIndex !== null && memories.length > 0 && (
        <MemoryViewer
          memories={memories}
          initialIndex={Math.min(viewerIndex, memories.length - 1)}
          resolveFullUrl={getFullUrl}
          resolveLocalUri={ensureLocalCopy}
          onClose={() => setViewerIndex(null)}
          onDelete={deleteMemory}
        />
      )}
    </View>
  );
}
