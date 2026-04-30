import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGroupChat } from '@features/groups/hooks/useGroupChat';
import { useGroupMembers } from '@features/groups/hooks/useGroupMembers';
import { useGroupMessages } from '@features/groups/hooks/useGroupMessages';
import { useGroupScreenshotDetection } from '@features/groups/hooks/useGroupScreenshotDetection';
import { GroupAvatar } from '@features/groups/components/GroupAvatar';
import { GroupChatInput } from '@features/groups/components/GroupChatInput';
import { GroupMessageBubble } from '@features/groups/components/GroupMessageBubble';
import { useReplyStore } from '@features/chat/store/replyStore';
import { useAuthStore } from '@features/auth/store/authStore';
import { useCameraStore } from '@features/camera/store/cameraStore';
import { useThemeColors } from '@lib/theme/useThemeColors';
import { userToMentionMember } from '@features/groups/utils/mentions';

export default function GroupChatScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const { groupId, name: paramName } = useLocalSearchParams<{
    groupId: string;
    name?: string;
  }>();

  const profile = useAuthStore((s) => s.profile);
  const { group } = useGroupChat(groupId);
  const { members } = useGroupMembers(groupId, group?.createdBy);
  const {
    messages,
    loading,
    viewedByMeIds,
    sendTextMessage,
    markViewed,
    markAllReceivedAsViewed,
    setMessageSaved,
    softDeleteMessage,
    postSystemMessage,
  } = useGroupMessages(groupId);

  useGroupScreenshotDetection(groupId);

  // Record text-message views on LEAVE, not on enter — otherwise the
  // visibility rule ("hide once everyone has seen it") would auto-hide
  // messages the user just walked into. Refs keep the cleanup stable
  // across renders so it only fires on unmount.
  const markRef = React.useRef(markAllReceivedAsViewed);
  React.useEffect(() => {
    markRef.current = markAllReceivedAsViewed;
  }, [markAllReceivedAsViewed]);
  React.useEffect(() => {
    return () => {
      markRef.current();
    };
  }, []);

  // Bail out if I'm no longer in the group (e.g., I left or was removed).
  // Send the user back to the camera — the app's standard home — instead
  // of the chat list, so the back stack never lands on a dead group.
  useEffect(() => {
    if (!loading && !group) {
      router.replace('/(app)/camera');
    }
  }, [loading, group, router]);

  useEffect(() => {
    return () => useReplyStore.getState().clear();
  }, []);

  const otherMembers = members.filter((m) => !m.isMe);
  const fallbackName =
    otherMembers.slice(0, 3).map((m) => m.user.display_name.split(' ')[0]).join(', ') ||
    'Group';
  const title = group?.name?.trim() || paramName || fallbackName;

  const mentionMembers = useMemo(
    () => members.map((m) => userToMentionMember(m.user)),
    [members]
  );

  if (!profile) return null;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.bg }} edges={['top']}>
      <View
        className="flex-row items-center gap-2 border-b px-3 py-3"
        style={{ borderColor: c.border }}>
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center"
          hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={c.icon} />
        </Pressable>

        <Pressable
          onPress={() =>
            router.push({
              pathname: '/(app)/chat/group/[groupId]/settings',
              params: { groupId, name: title },
            })
          }
          className="flex-1 flex-row items-center gap-2"
          hitSlop={6}>
          <GroupAvatar
            members={otherMembers.map((m) => m.user)}
            avatarUrl={null}
            size={34}
          />
          <View className="flex-1">
            <Text
              className="text-base font-bold"
              style={{ color: c.textPrimary }}
              numberOfLines={1}>
              {title}
            </Text>
            <Text className="text-xs" style={{ color: c.textSecondary }}>
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => {
            useCameraStore.getState().setDirectRecipient({
              kind: 'group',
              id: groupId,
              displayName: title,
            });
            router.push('/(app)/camera');
          }}
          className="h-9 w-9 items-center justify-center"
          hitSlop={8}>
          <Ionicons name="camera-outline" size={24} color={c.icon} />
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.accent} />
        </View>
      ) : messages.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8 py-12">
          <Text className="mb-3 text-5xl">👋</Text>
          <Text className="mb-1 text-lg font-bold" style={{ color: c.textPrimary }}>
            {title}
          </Text>
          <Text className="text-center text-sm" style={{ color: c.textSecondary }}>
            Say hi — send a snap or message to break the ice.
          </Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item, index }) => {
            const isOwn = item.sender_id === profile.id;
            const memberInfo = members.find((m) => m.user.id === item.sender_id);
            const authorName = isOwn
              ? profile.display_name
              : memberInfo?.user.display_name ?? 'Member';
            const authorAvatar = isOwn
              ? profile.avatar_url
              : memberInfo?.user.avatar_url ?? null;
            const previous = messages[index + 1];
            const showAuthor =
              !isOwn &&
              item.type !== 'system' &&
              (previous?.sender_id !== item.sender_id || previous?.type === 'system');
            const iAmMentioned = item.mentions.includes(profile.id);
            const viewedByMe = viewedByMeIds.has(item.id);

            return (
              <GroupMessageBubble
                message={item}
                isOwn={isOwn}
                authorName={authorName}
                authorAvatar={authorAvatar}
                members={mentionMembers}
                showAuthor={showAuthor}
                iAmMentioned={iAmMentioned}
                viewedByMe={viewedByMe}
                onMarkViewed={markViewed}
                onSetSaved={setMessageSaved}
                onDelete={softDeleteMessage}
                onPostSystem={postSystemMessage}
              />
            );
          }}
        />
      )}

      <GroupChatInput
        onSend={sendTextMessage}
        members={mentionMembers}
        onCameraPress={() => {
          useCameraStore.getState().setDirectRecipient({
            kind: 'group',
            id: groupId,
            displayName: title,
          });
          router.push('/(app)/camera');
        }}
      />
    </SafeAreaView>
  );
}
