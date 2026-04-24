import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSearch } from '@features/friends/hooks/useSearch';
import { useFriends, type FriendWithStatus } from '@features/friends/hooks/useFriends';
import { useFriendRequest } from '@features/friends/hooks/useFriendRequest';
import { useAuthStore } from '@features/auth/store/authStore';
import { Avatar } from '@components/ui/Avatar';
import { openChatWith } from '@features/chat/utils/openChat';
import type { DbUser } from '@/types/database';

type ButtonState = 'add' | 'pending_sent' | 'pending_received' | 'accepted';

export default function SearchScreen() {
  const router = useRouter();
  const { query, setQuery, results, loading: searchLoading } = useSearch();
  const { friends, pendingReceived, pendingSent, loading: friendsLoading, refresh } = useFriends();
  const { sendRequest, acceptRequest, declineRequest } = useFriendRequest();
  const profile = useAuthStore((s) => s.profile);

  const [actionMap, setActionMap] = useState<Record<string, 'sending' | 'accepting' | 'declining'>>({});

  const friendshipMap = useMemo(() => {
    const map = new Map<string, { state: ButtonState; friendshipId: string }>();
    friends.forEach((f) => map.set(f.id, { state: 'accepted', friendshipId: f.friendshipId }));
    pendingReceived.forEach((f) =>
      map.set(f.id, { state: 'pending_received', friendshipId: f.friendshipId }),
    );
    pendingSent.forEach((f) =>
      map.set(f.id, { state: 'pending_sent', friendshipId: f.friendshipId }),
    );
    return map;
  }, [friends, pendingReceived, pendingSent]);

  function getState(userId: string): ButtonState {
    return friendshipMap.get(userId)?.state ?? 'add';
  }

  async function handleAdd(user: DbUser) {
    setActionMap((m) => ({ ...m, [user.id]: 'sending' }));
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await sendRequest(user.id);
      await refresh();
    } catch {}
    finally {
      setActionMap((m) => { const n = { ...m }; delete n[user.id]; return n; });
    }
  }

  async function handleAccept(user: FriendWithStatus) {
    setActionMap((m) => ({ ...m, [user.id]: 'accepting' }));
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await acceptRequest(user.friendshipId);
      await refresh();
    } catch {}
    finally {
      setActionMap((m) => { const n = { ...m }; delete n[user.id]; return n; });
    }
  }

  async function handleDecline(user: FriendWithStatus) {
    setActionMap((m) => ({ ...m, [user.id]: 'declining' }));
    try {
      await declineRequest(user.friendshipId);
      await refresh();
    } catch {}
    finally {
      setActionMap((m) => { const n = { ...m }; delete n[user.id]; return n; });
    }
  }

  const filteredResults = results.filter((u) => u.id !== profile?.id);
  const isSearching = query.trim().length > 0;

  function renderActionButton(user: DbUser) {
    const state = getState(user.id);
    const busy = actionMap[user.id];

    if (busy) {
      return <ActivityIndicator color="#FFFC00" size="small" style={{ marginRight: 4 }} />;
    }

    if (state === 'accepted') {
      return (
        <Pressable
          onPress={() => profile && openChatWith(profile.id, user)}
          className="px-4 py-2 rounded-full bg-snap-yellow">
          <Text className="text-black text-sm font-bold">Chat</Text>
        </Pressable>
      );
    }

    if (state === 'pending_sent') {
      return (
        <View className="px-4 py-2 rounded-full bg-gray-100">
          <Text className="text-gray-500 text-sm font-semibold">Added</Text>
        </View>
      );
    }

    if (state === 'pending_received') {
      const fw = pendingReceived.find((f) => f.id === user.id)!;
      return (
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => handleDecline(fw)}
            className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center">
            <Ionicons name="close" size={16} color="#111" />
          </Pressable>
          <Pressable
            onPress={() => handleAccept(fw)}
            className="px-4 py-2 rounded-full bg-snap-yellow items-center justify-center">
            <Text className="text-black text-sm font-bold">Accept</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <Pressable
        onPress={() => handleAdd(user)}
        className="px-4 py-2 rounded-full bg-snap-yellow">
        <Text className="text-black text-sm font-bold">Add</Text>
      </Pressable>
    );
  }

  function UserRow({ user }: { user: DbUser }) {
    return (
      <View className="flex-row items-center px-4 py-3 bg-white">
        <Avatar uri={user.avatar_url} name={user.display_name} size={44} />
        <View className="flex-1 ml-3">
          <Text className="text-black font-semibold">{user.display_name}</Text>
          <Text className="text-gray-500 text-sm">@{user.username}</Text>
        </View>
        {renderActionButton(user)}
      </View>
    );
  }

  function SectionHeader({ label, count }: { label: string; count: number }) {
    return (
      <View className="px-4 pt-5 pb-2 bg-white">
        <Text className="text-gray-500 text-xs font-semibold uppercase tracking-widest">
          {label} · {count}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={['top']} className="bg-white">
        <View className="flex-row items-center px-4 pt-2 pb-3 gap-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color="#111" />
          </Pressable>

          <View className="flex-1 flex-row items-center bg-gray-100 rounded-xl px-3 py-2.5">
            <Ionicons name="search" size={18} color="#8E8E93" />
            <TextInput
              className="flex-1 text-black text-base ml-2"
              placeholder="Search friends"
              placeholderTextColor="#8E8E93"
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={6}>
                <Ionicons name="close-circle" size={18} color="#8E8E93" />
              </Pressable>
            )}
          </View>
        </View>
      </SafeAreaView>

      {isSearching ? (
        searchLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#FFFC00" />
          </View>
        ) : filteredResults.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="search-outline" size={48} color="#D1D1D6" />
            <Text className="text-gray-500 text-center mt-3">
              No users found for "{query}"
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredResults}
            keyExtractor={(u) => u.id}
            renderItem={({ item }) => <UserRow user={item} />}
            ItemSeparatorComponent={() => <View className="h-px bg-gray-100 ml-20" />}
            keyboardShouldPersistTaps="handled"
          />
        )
      ) : (
        <FlatList
          data={[]}
          keyExtractor={() => ''}
          renderItem={() => null}
          ListHeaderComponent={
            <View>
              {pendingReceived.length > 0 && (
                <View>
                  <SectionHeader label="Friend Requests" count={pendingReceived.length} />
                  {pendingReceived.map((u) => (
                    <UserRow key={u.id} user={u} />
                  ))}
                </View>
              )}

              {pendingSent.length > 0 && (
                <View>
                  <SectionHeader label="Sent Requests" count={pendingSent.length} />
                  {pendingSent.map((u) => (
                    <UserRow key={u.id} user={u} />
                  ))}
                </View>
              )}

              {friends.length > 0 && (
                <View>
                  <SectionHeader label="My Friends" count={friends.length} />
                  {friends.map((u) => (
                    <UserRow key={u.id} user={u} />
                  ))}
                </View>
              )}

              {!friendsLoading &&
                pendingReceived.length === 0 &&
                pendingSent.length === 0 &&
                friends.length === 0 && (
                  <View className="items-center justify-center px-8 pt-16">
                    <Ionicons name="people-outline" size={56} color="#D1D1D6" />
                    <Text className="text-black font-bold text-lg mt-4 mb-1">
                      Find your friends
                    </Text>
                    <Text className="text-gray-500 text-sm text-center">
                      Search by username to add friends and start snapping.
                    </Text>
                  </View>
                )}
            </View>
          }
        />
      )}
    </View>
  );
}
