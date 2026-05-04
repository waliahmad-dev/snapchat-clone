import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGroupChat } from '@features/groups/hooks/useGroupChat';
import { useGroupMembers } from '@features/groups/hooks/useGroupMembers';
import { useGroupNotificationSetting } from '@features/groups/hooks/useGroupNotificationSetting';
import { GroupAvatar } from '@features/groups/components/GroupAvatar';
import { renameGroup, leaveGroup } from '@features/groups/utils/groupActions';
import { Avatar } from '@components/ui/Avatar';
import { useAuthStore } from '@features/auth/store/authStore';
import { useThemeColors, type ThemeColors } from '@lib/theme/useThemeColors';
import type { GroupNotificationsSetting } from '@/types/database';

export default function GroupSettingsScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const profile = useAuthStore((s) => s.profile);
  const { group } = useGroupChat(groupId);
  const { members, myMembership } = useGroupMembers(groupId, group?.createdBy);

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(group?.name ?? '');

  const setNotifications = useGroupNotificationSetting(myMembership?.membershipId);

  if (!group || !profile) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: c.bg }}>
        <Header title="Group Info" onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  const otherMembers = members.filter((m) => !m.isMe);
  const fallbackName =
    otherMembers
      .slice(0, 3)
      .map((m) => m.user.display_name.split(' ')[0])
      .join(', ') || 'Group';
  const title = group.name?.trim() || fallbackName;

  async function commitRename() {
    setEditingName(false);
    const cleaned = draftName.trim();
    if (cleaned === (group?.name ?? '')) return;
    await renameGroup(groupId, cleaned || null);
  }

  async function handleLeave() {
    if (!myMembership || !profile) return;
    Alert.alert('Leave group?', 'Others will be notified you left.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await leaveGroup(groupId, profile.id, profile.display_name, myMembership.membershipId);
          // Drop straight back to the camera (the app's home).
          router.replace('/(app)/camera');
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.bg }} edges={['top']}>
      <Header title="Group Info" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="items-center pb-4 pt-6">
          <GroupAvatar
            members={otherMembers.map((m) => m.user)}
            avatarUrl={group.avatarUrl}
            size={96}
          />
          {editingName ? (
            <View className="mt-4 w-full px-8">
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                onBlur={commitRename}
                onSubmitEditing={commitRename}
                autoFocus
                placeholder="Group name"
                placeholderTextColor={c.placeholder}
                maxLength={50}
                className="rounded-xl px-4 py-3 text-center text-base"
                style={{ backgroundColor: c.inputBg, color: c.textPrimary }}
              />
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setDraftName(group.name ?? '');
                setEditingName(true);
              }}
              className="mt-3 flex-row items-center gap-1.5">
              <Text className="text-xl font-bold" style={{ color: c.textPrimary }}>
                {title}
              </Text>
              <Ionicons name="pencil-outline" size={16} color={c.iconMuted} />
            </Pressable>
          )}
          <Text className="mt-1 text-sm" style={{ color: c.textSecondary }}>
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </Text>
        </View>

        <SectionLabel c={c}>Notifications</SectionLabel>
        <View className="mx-4 overflow-hidden rounded-2xl" style={{ backgroundColor: c.surface }}>
          <NotificationOption
            value="all"
            label="All messages"
            sub="Get notified for every message"
            selected={myMembership?.notifications}
            onSelect={setNotifications}
            c={c}
          />
          <View className="ml-4 h-px" style={{ backgroundColor: c.divider }} />
          <NotificationOption
            value="mentions"
            label="Mentions only"
            sub="Get notified only when @-mentioned"
            selected={myMembership?.notifications}
            onSelect={setNotifications}
            c={c}
          />
          <View className="ml-4 h-px" style={{ backgroundColor: c.divider }} />
          <NotificationOption
            value="none"
            label="Mute"
            sub="Silence all notifications"
            selected={myMembership?.notifications}
            onSelect={setNotifications}
            c={c}
          />
        </View>

        <SectionLabel c={c}>Members</SectionLabel>
        <View className="mx-4 overflow-hidden rounded-2xl" style={{ backgroundColor: c.surface }}>
          {members.slice(0, 4).map((m, i) => (
            <View key={m.membershipId}>
              {i > 0 && <View className="ml-16 h-px" style={{ backgroundColor: c.divider }} />}
              <View className="flex-row items-center px-4 py-3">
                <Avatar uri={m.user.avatar_url ?? null} name={m.user.display_name} size={40} />
                <View className="ml-3 flex-1">
                  <Text className="text-base font-semibold" style={{ color: c.textPrimary }}>
                    {m.user.display_name}
                    {m.isMe ? ' (You)' : ''}
                  </Text>
                </View>
              </View>
            </View>
          ))}
          <View className="ml-4 h-px" style={{ backgroundColor: c.divider }} />
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(app)/chat/group/[groupId]/members',
                params: { groupId },
              })
            }
            className="px-4 py-4">
            <Text className="font-semibold" style={{ color: c.accent }}>
              See all members & add
            </Text>
          </Pressable>
        </View>

        <SectionLabel c={c}>Danger zone</SectionLabel>
        <View className="mx-4 overflow-hidden rounded-2xl" style={{ backgroundColor: c.surface }}>
          <Pressable
            onPress={handleLeave}
            android_ripple={{ color: c.rowPress }}
            className="flex-row items-center px-4 py-4">
            <Ionicons name="exit-outline" size={20} color={c.danger} />
            <Text className="ml-3 text-base font-semibold" style={{ color: c.danger }}>
              Leave group
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  const c = useThemeColors();
  return (
    <View className="flex-row items-center border-b px-3 py-3" style={{ borderColor: c.border }}>
      <Pressable onPress={onBack} hitSlop={8} className="h-9 w-9 items-center justify-center">
        <Ionicons name="chevron-back" size={26} color={c.icon} />
      </Pressable>
      <Text className="flex-1 text-center text-base font-bold" style={{ color: c.textPrimary }}>
        {title}
      </Text>
      <View className="w-9" />
    </View>
  );
}

function SectionLabel({ children, c }: { children: React.ReactNode; c: ThemeColors }) {
  return (
    <Text
      className="mb-2 mt-6 px-5 text-xs font-semibold uppercase tracking-widest"
      style={{ color: c.textSecondary }}>
      {children}
    </Text>
  );
}

function NotificationOption({
  value,
  label,
  sub,
  selected,
  onSelect,
  c,
}: {
  value: GroupNotificationsSetting;
  label: string;
  sub: string;
  selected: GroupNotificationsSetting | undefined;
  onSelect: (v: GroupNotificationsSetting) => void;
  c: ThemeColors;
}) {
  const isSelected = selected === value;
  return (
    <Pressable
      onPress={() => onSelect(value)}
      android_ripple={{ color: c.rowPress }}
      className="flex-row items-center px-4 py-3">
      <View className="flex-1">
        <Text className="text-base font-semibold" style={{ color: c.textPrimary }}>
          {label}
        </Text>
        <Text className="mt-0.5 text-xs" style={{ color: c.textSecondary }}>
          {sub}
        </Text>
      </View>
      {isSelected && <Ionicons name="checkmark" size={20} color={c.accent} />}
    </Pressable>
  );
}
