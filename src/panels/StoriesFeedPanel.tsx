import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStories, type StoryGroup } from '@features/stories/hooks/useStories';
import { StoryViewer } from '@features/stories/components/StoryViewer';
import { TopBar } from '@components/ui/TopBar';
import { BOTTOM_NAV_HEIGHT } from '@components/ui/BottomNav';
import { BreathingLoader } from '@components/ui/BreathingLoader';

export function StoriesFeedPanel() {
  const { storyGroups, loading, recordView, refresh } = useStories();
  const [activeGroup, setActiveGroup] = useState<StoryGroup | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={['top']} className="bg-white">
        <TopBar title="Stories" />
      </SafeAreaView>
      <BreathingLoader active={loading || refreshing} />

      {loading && storyGroups.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FFFC00" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: BOTTOM_NAV_HEIGHT + 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FFFC00"
              colors={['#FFFC00']}
            />
          }>
          <View className="px-4 pt-4 pb-2">
            <Text className="text-black font-bold text-base">Friends</Text>
          </View>

          {storyGroups.length === 0 ? (
            <View className="py-6 px-8">
              <Text className="text-gray-500 text-sm text-center">
                Add friends to see their stories here.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 16, paddingVertical: 4 }}>
              {storyGroups.map((group) => (
                <FriendStoryTile
                  key={group.user.id}
                  group={group}
                  onPress={() => setActiveGroup(group)}
                />
              ))}
            </ScrollView>
          )}

         
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
    </View>
  );
}

function FriendStoryTile({
  group,
  onPress,
}: {
  group: StoryGroup;
  onPress: () => void;
}) {
  const initial = group.user.display_name[0]?.toUpperCase() ?? '?';
  const unviewed = group.hasUnviewed;

  return (
    <Pressable onPress={onPress} className="items-center" style={{ width: 86 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          borderWidth: 3,
          borderColor: unviewed ? '#B14CFF' : '#D1D1D6',
          padding: 3,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <View
          style={{
            flex: 1,
            width: '100%',
            borderRadius: 32,
            backgroundColor: '#FFD36E',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text className="text-black font-bold text-2xl">{initial}</Text>
        </View>

        <View
          style={{
            position: 'absolute',
            bottom: -6,
            backgroundColor: '#B14CFF',
            borderRadius: 10,
            paddingHorizontal: 6,
            paddingVertical: 1,
          }}>
          <Text className="text-white text-xs font-bold">+{group.stories.length}</Text>
        </View>
      </View>

      <Text className="text-black font-semibold text-sm mt-2" numberOfLines={1}>
        {group.user.display_name}
      </Text>
      <Text className="text-gray-500 text-xs" numberOfLines={1}>
        @{group.user.username}
      </Text>
    </Pressable>
  );
}

function DiscoverCard({ tint, label }: { tint: string; label: string }) {
  return (
    <View
      className="rounded-xl overflow-hidden"
      style={{ width: '48.5%', aspectRatio: 0.65, backgroundColor: tint }}>
      <View className="flex-1 items-center justify-center">
        <Ionicons name="image-outline" size={48} color="rgba(255,255,255,0.7)" />
      </View>
      <View className="p-2 bg-black/30">
        <Text className="text-white font-bold text-sm" numberOfLines={2}>
          {label}
        </Text>
      </View>
    </View>
  );
}
