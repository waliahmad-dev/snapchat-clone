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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useConversations } from '@features/chat/hooks/useConversations';
import { ConversationRow } from '@features/chat/components/ConversationRow';
import { useFriends, type FriendWithStatus } from '@features/friends/hooks/useFriends';
import { FriendRequests } from '@features/friends/components/FriendRequests';
import { TopBar } from '@components/ui/TopBar';
import { BOTTOM_NAV_HEIGHT } from '@components/ui/BottomNav';
import { BreathingLoader } from '@components/ui/BreathingLoader';
import { Avatar } from '@components/ui/Avatar';
import { openChatWith } from '@features/chat/utils/openChat';
import { useAuthStore } from '@features/auth/store/authStore';

export function ChatListPanel() {
  const router = useRouter();
  const { conversations, loading, refresh: refreshConvs } = useConversations();
  const { friends, pendingReceived, refresh: refreshFriends } = useFriends();
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
    const convUserIds = new Set<string>(conversations.map((c) => c.partner.id));
    return { freshFriends: friends.filter((f) => !convUserIds.has(f.id)) };
  }, [friends, conversations]);

  const showEmptyState =
    !loading &&
    conversations.length === 0 &&
    freshFriends.length === 0 &&
    pendingReceived.length === 0;

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={['top']} className="bg-white">
        <TopBar title="Chat" />
      </SafeAreaView>
      <BreathingLoader active={loading || refreshing} />

      {pendingReceived.length > 0 && (
        <FriendRequests
          requests={pendingReceived}
          onAccepted={refreshFriends}
          onDeclined={refreshFriends}
        />
      )}

      {loading && conversations.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FFFC00" />
        </View>
      ) : showEmptyState ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="chatbubbles-outline" size={56} color="#D1D1D6" />
          <Text className="text-black text-lg font-bold mt-4 mb-1">No chats yet</Text>
          <Text className="text-gray-500 text-sm text-center">
            Add friends and start snapping!
          </Text>
          <Pressable
            onPress={() => router.push('/(app)/search')}
            className="mt-5 bg-snap-yellow rounded-full px-7 py-3">
            <Text className="text-black font-bold">Find Friends</Text>
          </Pressable>
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
              tintColor="#FFFC00"
              colors={['#FFFC00']}
            />
          }
          ItemSeparatorComponent={() => <View className="h-px bg-gray-100 ml-20" />}
          ListHeaderComponent={
            <View>
              {conversations.map((c) => (
                <ConversationRow key={c.id} conversation={c} />
              ))}

              {freshFriends.length > 0 && (
                <View>
                  {conversations.length > 0 && (
                    <View className="px-4 pt-5 pb-2 bg-white">
                      <Text className="text-gray-500 text-xs font-semibold uppercase tracking-widest">
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
  return (
    <Pressable
      onPress={onOpen}
      className="flex-row items-center px-4 py-3 bg-white active:bg-gray-50">
      <Avatar uri={friend.avatar_url} name={friend.display_name} size={48} />
      <View className="flex-1 mx-3">
        <Text className="text-black font-semibold text-base" numberOfLines={1}>
          {friend.display_name}
        </Text>
        <Text className="text-snap-yellow text-sm font-semibold" numberOfLines={1}>
          👋 Say hi to {friend.display_name.split(' ')[0]}!
        </Text>
      </View>
      <View className="w-9 h-9 rounded-full items-center justify-center">
        <Ionicons name="chatbubble-outline" size={20} color="#111" />
      </View>
    </Pressable>
  );
}
