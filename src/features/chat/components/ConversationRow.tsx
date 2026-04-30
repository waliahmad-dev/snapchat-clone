import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ConversationWithPartner, ConversationStatus } from '../hooks/useConversations';
import { useAuthStore } from '@features/auth/store/authStore';
import { useStreak } from '../hooks/useStreak';
import { shortTimeAgo } from '../utils/messageHelpers';
import { useCameraStore } from '@features/camera/store/cameraStore';
import { Avatar } from '@components/ui/Avatar';
import { useThemeColors, type ThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  conversation: ConversationWithPartner;
}

function describeStatus(
  status: ConversationStatus,
  c: ThemeColors
): {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
} {
  switch (status) {
    case 'sent':
      return { label: 'Sent', icon: 'send', color: '#00C2FF' };
    case 'opened':
      return { label: 'Opened', icon: 'checkmark-done', color: c.textMuted };
    case 'replied':
      return { label: 'Replied', icon: 'return-down-back', color: '#B14CFF' };
    case 'received':
      return { label: 'Sent you a Message', icon: 'chatbubble', color: '#00C2FF' };
    case 'empty':
    default:
      return { label: 'Say hi!', icon: 'hand-right', color: '#FFC300' };
  }
}

export function ConversationRow({ conversation }: Props) {
  const router = useRouter();
  const c = useThemeColors();
  const profile = useAuthStore((s) => s.profile);
  const streak = useStreak(profile?.id ?? '', conversation.partner.id);

  const { label, icon, color } = describeStatus(conversation.status, c);
  const timeLabel = shortTimeAgo(conversation.lastActivityAt);

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/(app)/chat/[conversationId]',
          params: {
            conversationId: conversation.id,
            friendId: conversation.partner.id,
            friendName: conversation.partner.display_name,
            ...(conversation.unviewed_snap_ids.length > 0
              ? { autoSnapIds: conversation.unviewed_snap_ids.join(',') }
              : {}),
          },
        })
      }
      android_ripple={{ color: c.rowPress }}
      className="flex-row items-center px-4 py-3">
      <Avatar
        uri={conversation.partner.avatar_url ?? null}
        name={conversation.partner.display_name}
        size={48}
      />

      <View className="mx-3 flex-1">
        <View className="flex-row items-center">
          <Text
            className="flex-shrink text-base font-semibold"
            style={{ color: c.textPrimary }}
            numberOfLines={1}>
            {conversation.partner.display_name}
          </Text>
          {streak && streak.count > 0 && (
            <Text
              className="ml-1.5 text-sm font-semibold"
              style={{ color: c.textPrimary }}
              numberOfLines={1}>
              {streak.count}🔥
            </Text>
          )}
          {conversation.unread_count > 0 && (
            <View
              className="ml-2 h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5"
              style={{ backgroundColor: c.danger }}>
              <Text className="text-[10px] font-bold" style={{ color: '#FFFFFF' }}>
                Wali {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
              </Text>
            </View>
          )}
        </View>
        <View className="mt-0.5 flex-row items-center">
          <Ionicons name={icon} size={12} color={color} style={{ marginRight: 5 }} />
          <Text
            className="text-sm"
            numberOfLines={1}
            style={{
              color: conversation.status === 'empty' ? '#FFC300' : c.textSecondary,
            }}>
            {label}
            {timeLabel ? ` · ${timeLabel}` : ''}
          </Text>
        </View>
      </View>

      <Pressable
        hitSlop={6}
        onPress={(e) => {
          e.stopPropagation();
          useCameraStore.getState().setDirectRecipient({
            id: conversation.partner.id,
            displayName: conversation.partner.display_name,
          });
          router.push('/(app)/camera');
        }}
        className="h-9 w-9 items-center justify-center rounded-full">
        <Ionicons name="camera-outline" size={22} color={c.icon} />
      </Pressable>
    </Pressable>
  );
}
