import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  SectionList,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@features/auth/store/authStore';
import { useCameraStore } from '../store/cameraStore';
import { sendSnapToRecipients } from '../utils/sendSnap';
import { useFriends } from '@features/friends/hooks/useFriends';
import { useGroupChats, type GroupChatSummary } from '@features/groups/hooks/useGroupChats';
import { GroupAvatar } from '@features/groups/components/GroupAvatar';
import type { DbUser } from '@/types/database';

interface Props {
  imageUri: string;
  onClose: () => void;
}

type SectionItem =
  | { kind: 'user'; user: DbUser }
  | { kind: 'group'; group: GroupChatSummary };

interface RecipientSection {
  title: string;
  data: SectionItem[];
}

export function RecipientSelector({ imageUri, onClose }: Props) {
  const { t } = useTranslation();
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [sendToStory, setSendToStory] = useState(false);
  const [sending, setSending] = useState(false);
  const profile = useAuthStore((s) => s.profile);
  const reset = useCameraStore((s) => s.reset);
  const { friends: friendList, loading: friendsLoading } = useFriends();
  const { groups, loading: groupsLoading } = useGroupChats();
  const friends: DbUser[] = friendList;

  const sections = useMemo<RecipientSection[]>(() => {
    const out: RecipientSection[] = [];
    if (groups.length > 0) {
      out.push({
        title: t('camera.recipients.groups'),
        data: groups.map((g) => ({ kind: 'group', group: g }) as SectionItem),
      });
    }
    if (friends.length > 0) {
      out.push({
        title: t('camera.recipients.friends'),
        data: friends.map((u) => ({ kind: 'user', user: u }) as SectionItem),
      });
    }
    return out;
  }, [groups, friends, t]);

  function toggleFriend(id: string) {
    Haptics.selectionAsync();
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(id: string) {
    Haptics.selectionAsync();
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend() {
    if (
      !profile ||
      (selectedFriends.size === 0 && selectedGroups.size === 0 && !sendToStory)
    ) {
      return;
    }

    setSending(true);
    try {
      await sendSnapToRecipients({
        senderId: profile.id,
        senderName: profile.display_name,
        imageUri,
        recipientIds: Array.from(selectedFriends),
        groupIds: Array.from(selectedGroups),
        postToMyStory: sendToStory,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset();
      onClose();
    } catch (err) {
      console.error('[Snap send]', err);
      Alert.alert(
        t('camera.preview.couldNotSendTitle'),
        err instanceof Error ? err.message : t('common.tryAgain'),
      );
    } finally {
      setSending(false);
    }
  }

  const totalSelected =
    selectedFriends.size + selectedGroups.size + (sendToStory ? 1 : 0);
  const loading = friendsLoading || groupsLoading;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-black">
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-white/10">
          <Pressable onPress={onClose}>
            <Text className="text-snap-yellow text-base">{t('common.cancel')}</Text>
          </Pressable>
          <Text className="text-white font-bold text-base">{t('camera.recipients.title')}</Text>
          <Pressable onPress={handleSend} disabled={sending || totalSelected === 0}>
            {sending ? (
              <ActivityIndicator color="#FFFC00" />
            ) : (
              <Text
                className={`font-bold text-base ${totalSelected > 0 ? 'text-snap-yellow' : 'text-white/30'}`}>
                {t('common.send')}
              </Text>
            )}
          </Pressable>
        </View>

        <Pressable
          onPress={() => setSendToStory((v) => !v)}
          className="flex-row items-center px-4 py-4 border-b border-white/10">
          <View className="w-12 h-12 rounded-full bg-snap-yellow items-center justify-center mr-4">
            <Text className="text-2xl">📖</Text>
          </View>
          <Text className="text-white font-semibold flex-1">{t('camera.recipients.myStory')}</Text>
          <View
            className={`w-6 h-6 rounded-full border-2 items-center justify-center ${sendToStory ? 'bg-snap-yellow border-snap-yellow' : 'border-white/40'}`}>
            {sendToStory && <Text className="text-black text-xs">✓</Text>}
          </View>
        </Pressable>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#FFFC00" />
          </View>
        ) : sections.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-white/50 text-center">
              {t('camera.recipients.emptyBody')}
            </Text>
          </View>
        ) : (
          <SectionList<SectionItem, RecipientSection>
            sections={sections}
            keyExtractor={(item) =>
              item.kind === 'user' ? `f:${item.user.id}` : `g:${item.group.id}`
            }
            renderSectionHeader={({ section }) => (
              <View className="px-4 py-2 bg-black">
                <Text className="text-white/50 text-xs uppercase tracking-widest font-semibold">
                  {section.title}
                </Text>
              </View>
            )}
            renderItem={({ item }) => {
              if (item.kind === 'group') {
                const g = item.group;
                const isSelected = selectedGroups.has(g.id);
                const fallbackName =
                  g.members
                    .slice(0, 3)
                    .map((m) => m.display_name.split(' ')[0])
                    .join(', ') || 'Group';
                return (
                  <Pressable
                    onPress={() => toggleGroup(g.id)}
                    className="flex-row items-center px-4 py-3 border-b border-white/5">
                    <View className="mr-4">
                      <GroupAvatar members={g.members} avatarUrl={g.avatarUrl} size={48} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-semibold">
                        {g.name?.trim() || fallbackName}
                      </Text>
                      <Text className="text-snap-gray text-sm">
                        {t('camera.recipients.memberCount', { count: g.members.length + 1 })}
                      </Text>
                    </View>
                    <View
                      className={`w-6 h-6 rounded-full border-2 items-center justify-center ${isSelected ? 'bg-snap-yellow border-snap-yellow' : 'border-white/40'}`}>
                      {isSelected && <Text className="text-black text-xs">✓</Text>}
                    </View>
                  </Pressable>
                );
              }

              const u = item.user;
              const isSelected = selectedFriends.has(u.id);
              return (
                <Pressable
                  onPress={() => toggleFriend(u.id)}
                  className="flex-row items-center px-4 py-3 border-b border-white/5">
                  <View className="w-12 h-12 rounded-full bg-snap-surface items-center justify-center mr-4">
                    <Text className="text-white font-bold text-base">
                      {u.display_name[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold">{u.display_name}</Text>
                    <Text className="text-snap-gray text-sm">@{u.username}</Text>
                  </View>
                  <View
                    className={`w-6 h-6 rounded-full border-2 items-center justify-center ${isSelected ? 'bg-snap-yellow border-snap-yellow' : 'border-white/40'}`}>
                    {isSelected && <Text className="text-black text-xs">✓</Text>}
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
