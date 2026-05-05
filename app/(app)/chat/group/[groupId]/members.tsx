import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@components/ui/Avatar';
import { useGroupChat } from '@features/groups/hooks/useGroupChat';
import { useGroupMembers } from '@features/groups/hooks/useGroupMembers';
import { MemberRow } from '@features/groups/components/MemberRow';
import { useFriends } from '@features/friends/hooks/useFriends';
import { useAuthStore } from '@features/auth/store/authStore';
import { addMembersToGroup } from '@features/groups/utils/groupActions';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function MembersScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const c = useThemeColors();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const profile = useAuthStore((s) => s.profile);
  const { group } = useGroupChat(groupId);
  const { members } = useGroupMembers(groupId, group?.createdBy);

  const [adderOpen, setAdderOpen] = useState(false);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.bg }} edges={['top']}>
      <View
        className="flex-row items-center px-3 py-3 border-b"
        style={{ borderColor: c.border }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center">
          <Ionicons name="chevron-back" size={26} color={c.icon} />
        </Pressable>
        <Text
          className="flex-1 text-center text-base font-bold"
          style={{ color: c.textPrimary }}>
          {t('chat.group.members.title', { count: members.length })}
        </Text>
        <Pressable
          onPress={() => setAdderOpen(true)}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center">
          <Ionicons name="person-add-outline" size={22} color={c.accent} />
        </Pressable>
      </View>

      <FlatList
        data={members}
        keyExtractor={(m) => m.membershipId}
        ItemSeparatorComponent={() => (
          <View className="h-px ml-16" style={{ backgroundColor: c.divider }} />
        )}
        renderItem={({ item }) => <MemberRow member={item} />}
      />

      {adderOpen && profile && (
        <AddMembersModal
          groupId={groupId}
          existingUserIds={members.map((m) => m.user.id)}
          myId={profile.id}
          myName={profile.display_name}
          onClose={() => setAdderOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

function AddMembersModal({
  groupId,
  existingUserIds,
  myId,
  myName,
  onClose,
}: {
  groupId: string;
  existingUserIds: string[];
  myId: string;
  myName: string;
  onClose: () => void;
}) {
  const c = useThemeColors();
  const { t } = useTranslation();
  const { friends, loading } = useFriends();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const eligible = useMemo(() => {
    const existing = new Set(existingUserIds);
    return friends.filter((f) => !existing.has(f.id));
  }, [friends, existingUserIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter(
      (f) =>
        f.display_name.toLowerCase().includes(q) ||
        f.username.toLowerCase().includes(q)
    );
  }, [eligible, query]);

  function toggle(id: string) {
    Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    if (selected.size === 0) return;
    setAdding(true);
    try {
      const ids = Array.from(selected);
      const names: Record<string, string> = {};
      for (const id of ids) {
        const f = friends.find((x) => x.id === id);
        if (f) names[id] = f.display_name;
      }
      await addMembersToGroup(groupId, myId, myName, ids, names);
      onClose();
    } catch (err) {
      Alert.alert(
        t('chat.group.members.errorAddTitle'),
        err instanceof Error ? err.message : t('common.tryAgain'),
      );
    } finally {
      setAdding(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1" style={{ backgroundColor: c.bg }}>
        <View
          className="flex-row items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: c.border }}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text className="text-base" style={{ color: c.textSecondary }}>
              {t('common.cancel')}
            </Text>
          </Pressable>
          <Text className="text-lg font-bold" style={{ color: c.textPrimary }}>
            {t('chat.group.members.addTitle')}
          </Text>
          <Pressable onPress={handleAdd} disabled={adding || selected.size === 0} hitSlop={8}>
            {adding ? (
              <ActivityIndicator color={c.accent} />
            ) : (
              <Text
                className="text-base font-bold"
                style={{ color: selected.size > 0 ? c.accent : c.textMuted }}>
                {selected.size > 0
                  ? t('chat.group.members.addButtonCount', { count: selected.size })
                  : t('chat.group.members.addButton')}
              </Text>
            )}
          </Pressable>
        </View>

        <View className="px-4 pt-3 pb-2">
          <View
            className="flex-row items-center rounded-full px-3 py-2"
            style={{ backgroundColor: c.inputBg }}>
            <Ionicons name="search" size={16} color={c.iconMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('chat.group.members.searchPlaceholder')}
              placeholderTextColor={c.placeholder}
              className="flex-1 ml-2 text-sm"
              style={{ color: c.textPrimary }}
            />
          </View>
        </View>

        {loading && eligible.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={c.accent} />
          </View>
        ) : eligible.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="people-outline" size={48} color={c.iconMuted} />
            <Text className="text-sm text-center mt-3" style={{ color: c.textSecondary }}>
              {t('chat.group.members.emptyBody')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(f) => f.id}
            ItemSeparatorComponent={() => (
              <View className="h-px ml-16" style={{ backgroundColor: c.divider }} />
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
                      style={{ color: c.textPrimary }}>
                      {item.display_name}
                    </Text>
                    <Text className="text-sm" style={{ color: c.textSecondary }}>
                      @{item.username}
                    </Text>
                  </View>
                  <View
                    className="w-6 h-6 rounded-full border-2 items-center justify-center"
                    style={{
                      borderColor: isSelected ? c.accent : c.border,
                      backgroundColor: isSelected ? c.accent : 'transparent',
                    }}>
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color={c.accentText} />
                    )}
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
