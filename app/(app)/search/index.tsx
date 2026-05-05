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
import { useTranslation } from 'react-i18next';
import { useSearch } from '@features/friends/hooks/useSearch';
import { useFriends, type FriendWithStatus } from '@features/friends/hooks/useFriends';
import { useFriendRequest } from '@features/friends/hooks/useFriendRequest';
import { useAuthStore } from '@features/auth/store/authStore';
import { Avatar } from '@components/ui/Avatar';
import { openChatWith } from '@features/chat/utils/openChat';
import { useThemeColors, type ThemeColors } from '@lib/theme/useThemeColors';
import type { DbUser } from '@/types/database';

type ButtonState = 'add' | 'pending_sent' | 'pending_received' | 'accepted';

export default function SearchScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const c = useThemeColors();
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
      return <ActivityIndicator color={c.accent} size="small" style={{ marginRight: 4 }} />;
    }

    if (state === 'accepted') {
      return (
        <Pressable
          onPress={() => profile && openChatWith(profile.id, user)}
          className="px-4 py-2 rounded-full"
          style={{ backgroundColor: c.accent }}>
          <Text className="text-sm font-bold" style={{ color: c.accentText }}>
            {t('search.chat')}
          </Text>
        </Pressable>
      );
    }

    if (state === 'pending_sent') {
      return (
        <View
          className="px-4 py-2 rounded-full"
          style={{ backgroundColor: c.surfaceElevated }}>
          <Text className="text-sm font-semibold" style={{ color: c.textMuted }}>
            {t('search.added')}
          </Text>
        </View>
      );
    }

    if (state === 'pending_received') {
      const fw = pendingReceived.find((f) => f.id === user.id)!;
      return (
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => handleDecline(fw)}
            className="w-9 h-9 rounded-full items-center justify-center"
            style={{ backgroundColor: c.surfaceElevated }}>
            <Ionicons name="close" size={16} color={c.icon} />
          </Pressable>
          <Pressable
            onPress={() => handleAccept(fw)}
            className="px-4 py-2 rounded-full items-center justify-center"
            style={{ backgroundColor: c.accent }}>
            <Text className="text-sm font-bold" style={{ color: c.accentText }}>
              {t('search.accept')}
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <Pressable
        onPress={() => handleAdd(user)}
        className="px-4 py-2 rounded-full"
        style={{ backgroundColor: c.accent }}>
        <Text className="text-sm font-bold" style={{ color: c.accentText }}>
          {t('search.add')}
        </Text>
      </Pressable>
    );
  }

  function UserRow({ user }: { user: DbUser }) {
    return (
      <View
        className="flex-row items-center px-4 py-3"
        style={{ backgroundColor: c.bg }}>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/(app)/profile/[userId]',
              params: { userId: user.id },
            })
          }
          className="flex-row items-center flex-1"
          hitSlop={4}>
          <Avatar uri={user.avatar_url} name={user.display_name} size={44} />
          <View className="flex-1 ml-3">
            <Text className="font-semibold" style={{ color: c.textPrimary }}>
              {user.display_name}
            </Text>
            <Text className="text-sm" style={{ color: c.textSecondary }}>
              @{user.username}
            </Text>
          </View>
        </Pressable>
        {renderActionButton(user)}
      </View>
    );
  }

  function SectionHeader({ label, count }: { label: string; count: number }) {
    return (
      <View className="px-4 pt-5 pb-2" style={{ backgroundColor: c.bg }}>
        <Text
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: c.textSecondary }}>
          {label} · {count}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: c.bg }}>
        <View className="flex-row items-center px-4 pt-2 pb-3 gap-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={c.icon} />
          </Pressable>

          <View
            className="flex-1 flex-row items-center rounded-xl px-3 py-2.5"
            style={{ backgroundColor: c.inputBg }}>
            <Ionicons name="search" size={18} color={c.iconMuted} />
            <TextInput
              className="flex-1 text-base ml-2"
              style={{ color: c.textPrimary }}
              placeholder={t('search.placeholder')}
              placeholderTextColor={c.placeholder}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={6}>
                <Ionicons name="close-circle" size={18} color={c.iconMuted} />
              </Pressable>
            )}
          </View>
        </View>
      </SafeAreaView>

      {isSearching ? (
        searchLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={c.accent} />
          </View>
        ) : filteredResults.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="search-outline" size={48} color={c.iconMuted} />
            <Text className="text-center mt-3" style={{ color: c.textSecondary }}>
              {t('search.noResults', { query })}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredResults}
            keyExtractor={(u) => u.id}
            renderItem={({ item }) => <UserRow user={item} />}
            ItemSeparatorComponent={() => (
              <View className="h-px ml-20" style={{ backgroundColor: c.divider }} />
            )}
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
                  <SectionHeader label={t('search.friendRequestsLabel')} count={pendingReceived.length} />
                  {pendingReceived.map((u) => (
                    <UserRow key={u.id} user={u} />
                  ))}
                </View>
              )}

              {pendingSent.length > 0 && (
                <View>
                  <SectionHeader label={t('search.sentRequestsLabel')} count={pendingSent.length} />
                  {pendingSent.map((u) => (
                    <UserRow key={u.id} user={u} />
                  ))}
                </View>
              )}

              {friends.length > 0 && (
                <View>
                  <SectionHeader label={t('search.myFriendsLabel')} count={friends.length} />
                  {friends.map((u) => (
                    <UserRow key={u.id} user={u} />
                  ))}
                </View>
              )}

              {!friendsLoading &&
                pendingReceived.length === 0 &&
                pendingSent.length === 0 &&
                friends.length === 0 && (
                  <EmptyState colors={c} />
                )}
            </View>
          }
        />
      )}
    </View>
  );
}

function EmptyState({ colors }: { colors: ThemeColors }) {
  const { t } = useTranslation();
  return (
    <View className="items-center justify-center px-8 pt-16">
      <Ionicons name="people-outline" size={56} color={colors.iconMuted} />
      <Text className="font-bold text-lg mt-4 mb-1" style={{ color: colors.textPrimary }}>
        {t('search.emptyTitle')}
      </Text>
      <Text className="text-sm text-center" style={{ color: colors.textSecondary }}>
        {t('search.emptyBody')}
      </Text>
    </View>
  );
}
