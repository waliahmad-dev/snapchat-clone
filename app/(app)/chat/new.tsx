import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Avatar } from '@components/ui/Avatar';
import { useFriends } from '@features/friends/hooks/useFriends';
import { useAuthStore } from '@features/auth/store/authStore';
import { openChatWith } from '@features/chat/utils/openChat';
import { createGroup, openGroupChat } from '@features/groups/utils/createGroup';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function NewChatScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const profile = useAuthStore((s) => s.profile);
  const { friends, loading } = useFriends();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) => f.display_name.toLowerCase().includes(q) || f.username.toLowerCase().includes(q)
    );
  }, [friends, query]);

  function toggle(id: string) {
    Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleStart() {
    if (!profile || selected.size === 0) return;
    setCreating(true);
    try {
      const ids = Array.from(selected);
      if (ids.length === 1) {
        const friend = friends.find((f) => f.id === ids[0]);
        if (!friend) return;
        await openChatWith(profile.id, friend);
        router.dismiss();
        return;
      }

      const groupId = await createGroup({
        creatorId: profile.id,
        creatorName: profile.display_name,
        memberIds: ids,
        name: groupName.trim() || null,
      });
      router.dismiss();
      openGroupChat(groupId, groupName.trim() || null);
    } catch (err) {
      Alert.alert('Could not start chat', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setCreating(false);
    }
  }

  const isGroup = selected.size >= 2;
  const ctaLabel = isGroup ? `Chat (${selected.size})` : selected.size === 1 ? 'Chat' : 'Chat';

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.bg }} edges={['top']}>
      <View
        className="flex-row items-center justify-between border-b px-4 pb-3 pt-2"
        style={{ borderColor: c.border }}>
        <Pressable onPress={() => router.dismiss()} hitSlop={8}>
          <Text className="text-base" style={{ color: c.textSecondary }}>
            Cancel
          </Text>
        </Pressable>
        <Text className="text-lg font-bold" style={{ color: c.textPrimary }}>
          New Chat
        </Text>
        <Pressable onPress={handleStart} disabled={creating || selected.size === 0} hitSlop={8}>
          {creating ? (
            <ActivityIndicator color={c.accent} />
          ) : (
            <Text
              className="text-base font-bold"
              style={{ color: selected.size > 0 ? c.accent : c.textMuted }}>
              {ctaLabel}
            </Text>
          )}
        </Pressable>
      </View>

      {isGroup && (
        <View className="px-4 pb-2 pt-3">
          <TextInput
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Group name (optional)"
            placeholderTextColor={c.placeholder}
            maxLength={50}
            className="rounded-xl px-4 py-3 text-base"
            style={{ backgroundColor: c.inputBg, color: c.textPrimary }}
          />
        </View>
      )}

      <View className="px-4 pb-2 pt-3">
        <View
          className="flex-row items-center rounded-full px-3 py-2"
          style={{ backgroundColor: c.inputBg }}>
          <Ionicons name="search" size={16} color={c.iconMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search friends"
            placeholderTextColor={c.placeholder}
            className="ml-2 flex-1 text-sm"
            style={{ color: c.textPrimary }}
          />
        </View>
      </View>

      {selected.size > 0 && (
        <View className="px-4 pb-2">
          <Text className="text-xs" style={{ color: c.textSecondary }}>
            {selected.size} selected
          </Text>
        </View>
      )}

      {loading && friends.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.accent} />
        </View>
      ) : friends.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="people-outline" size={48} color={c.iconMuted} />
          <Text className="mt-3 text-base font-bold" style={{ color: c.textPrimary }}>
            No friends yet
          </Text>
          <Text className="mt-1 text-center text-sm" style={{ color: c.textSecondary }}>
            Add friends from your profile to start a chat.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(f) => f.id}
          ItemSeparatorComponent={() => (
            <View className="ml-16 h-px" style={{ backgroundColor: c.divider }} />
          )}
          renderItem={({ item }) => {
            const isSelected = selected.has(item.id);
            return (
              <Pressable
                onPress={() => toggle(item.id)}
                android_ripple={{ color: c.rowPress }}
                className="flex-row items-center px-4 py-3">
                <Avatar uri={item.avatar_url} name={item.display_name} size={44} />
                <View className="mx-3 flex-1">
                  <Text
                    className="text-base font-semibold"
                    style={{ color: c.textPrimary }}
                    numberOfLines={1}>
                    {item.display_name}
                  </Text>
                  <Text className="text-sm" style={{ color: c.textSecondary }}>
                    @{item.username}
                  </Text>
                </View>
                <View
                  className="h-6 w-6 items-center justify-center rounded-full border-2"
                  style={{
                    borderColor: isSelected ? c.accent : c.border,
                    backgroundColor: isSelected ? c.accent : 'transparent',
                  }}>
                  {isSelected && <Ionicons name="checkmark" size={14} color={c.accentText} />}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
