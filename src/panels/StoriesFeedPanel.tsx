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
import { useStories, type StoryGroup } from '@features/stories/hooks/useStories';
import { StoryViewer } from '@features/stories/components/StoryViewer';
import { TopBar } from '@components/ui/TopBar';
import { BOTTOM_NAV_HEIGHT } from '@components/ui/BottomNav';
import { BreathingLoader } from '@components/ui/BreathingLoader';
import { useThemeColors } from '@lib/theme/useThemeColors';

export function StoriesFeedPanel() {
  const c = useThemeColors();
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
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: c.bg }}>
        <TopBar title="Stories" />
      </SafeAreaView>
      <BreathingLoader active={loading || refreshing} />

      {loading && storyGroups.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.accent} />
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
              tintColor={c.accent}
              colors={[c.accent]}
            />
          }>
          <View className="px-4 pt-4 pb-2">
            <Text className="font-bold text-base" style={{ color: c.textPrimary }}>
              Friends
            </Text>
          </View>

          {storyGroups.length === 0 ? (
            <View className="py-6 px-8">
              <Text className="text-sm text-center" style={{ color: c.textSecondary }}>
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
              onStoryDeleted={refresh}
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
  const c = useThemeColors();
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
          borderColor: unviewed ? '#B14CFF' : c.border,
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
          <Text className="font-bold text-2xl" style={{ color: '#000000' }}>
            {initial}
          </Text>
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
          <Text className="text-xs font-bold" style={{ color: '#FFFFFF' }}>
            +{group.stories.length}
          </Text>
        </View>
      </View>

      <Text
        className="font-semibold text-sm mt-2"
        style={{ color: c.textPrimary }}
        numberOfLines={1}>
        {group.user.display_name}
      </Text>
      <Text className="text-xs" style={{ color: c.textSecondary }} numberOfLines={1}>
        @{group.user.username}
      </Text>
    </Pressable>
  );
}
