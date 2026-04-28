import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useConversations } from '@features/chat/hooks/useConversations';
import { ConversationRow } from '@features/chat/components/ConversationRow';
import { useFriends, type FriendWithStatus } from '@features/friends/hooks/useFriends';
import { TopBar } from '@components/ui/TopBar';
import { BOTTOM_NAV_HEIGHT } from '@components/ui/BottomNav';
import { BreathingLoader } from '@components/ui/BreathingLoader';
import { Avatar } from '@components/ui/Avatar';
import { openChatWith } from '@features/chat/utils/openChat';
import { useAuthStore } from '@features/auth/store/authStore';
import { useThemeColors } from '@lib/theme/useThemeColors';

export function ChatListPanel() {
  const c = useThemeColors();
  const { conversations, loading, refresh: refreshConvs } = useConversations();
  const { friends, refresh: refreshFriends } = useFriends();
  const profile = useAuthStore((s) => s.profile);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshConvs(), refreshFriends()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshConvs, refreshFriends]);

  const { freshFriends } = useMemo(() => {
    const convUserIds = new Set<string>(conversations.map((cv) => cv.partner.id));
    return { freshFriends: friends.filter((f) => !convUserIds.has(f.id)) };
  }, [friends, conversations]);

  const showEmptyState =
    !loading && conversations.length === 0 && freshFriends.length === 0;

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: c.bg }}>
        <TopBar title="Chat" />
      </SafeAreaView>
      <BreathingLoader active={loading || refreshing} />

      {loading && conversations.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.accent} />
        </View>
      ) : showEmptyState ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="chatbubbles-outline" size={56} color={c.iconMuted} />
          <Text className="text-lg font-bold mt-4 mb-1" style={{ color: c.textPrimary }}>
            No chats yet
          </Text>
          <Text className="text-sm text-center" style={{ color: c.textSecondary }}>
            Add friends from your profile to start snapping.
          </Text>
        </View>
      ) : (
        <FlatList
          data={[]}
          keyExtractor={() => ''}
          renderItem={() => null}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: BOTTOM_NAV_HEIGHT }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={c.accent}
              colors={[c.accent]}
            />
          }
          ItemSeparatorComponent={() => (
            <View className="h-px ml-20" style={{ backgroundColor: c.divider }} />
          )}
          ListHeaderComponent={
            <View>
              {conversations.map((cv) => (
                <ConversationRow key={cv.id} conversation={cv} />
              ))}

              {freshFriends.length > 0 && (
                <View>
                  {conversations.length > 0 && (
                    <View
                      className="px-4 pt-5 pb-2"
                      style={{ backgroundColor: c.bg }}>
                      <Text
                        className="text-xs font-semibold uppercase tracking-widest"
                        style={{ color: c.textSecondary }}>
                        New Friends · {freshFriends.length}
                      </Text>
                    </View>
                  )}
                  {freshFriends.map((f) => (
                    <NewFriendRow
                      key={f.id}
                      friend={f}
                      onOpen={() => profile && openChatWith(profile.id, f)}
                    />
                  ))}
                </View>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

function NewFriendRow({
  friend,
  onOpen,
}: {
  friend: FriendWithStatus;
  onOpen: () => void;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onOpen}
      android_ripple={{ color: c.rowPress }}
      className="flex-row items-center px-4 py-3"
      style={{ backgroundColor: c.bg }}>
      <Avatar uri={friend.avatar_url} name={friend.display_name} size={48} />
      <View className="flex-1 mx-3">
        <Text
          className="font-semibold text-base"
          style={{ color: c.textPrimary }}
          numberOfLines={1}>
          {friend.display_name}
        </Text>
        <Text
          className="text-sm font-semibold"
          style={{ color: c.accent }}
          numberOfLines={1}>
          👋 Say hi to {friend.display_name.split(' ')[0]}!
        </Text>
      </View>
      <View className="w-9 h-9 rounded-full items-center justify-center">
        <Ionicons name="chatbubble-outline" size={20} color={c.icon} />
      </View>
    </Pressable>
  );
}
