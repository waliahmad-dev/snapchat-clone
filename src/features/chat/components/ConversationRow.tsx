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
  c: ThemeColors,
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

      <View className="flex-1 mx-3">
        <View className="flex-row items-center">
          <Text
            className="font-semibold text-base flex-shrink"
            style={{ color: c.textPrimary }}
            numberOfLines={1}>
            {conversation.partner.display_name}
          </Text>
          {conversation.unread_count > 0 && (
            <View
              className="ml-2 min-w-[18px] h-[18px] rounded-full px-1.5 items-center justify-center"
              style={{ backgroundColor: c.danger }}>
              <Text className="font-bold text-[10px]" style={{ color: '#FFFFFF' }}>
                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
              </Text>
            </View>
          )}
        </View>
        <View className="flex-row items-center mt-0.5">
          <Ionicons name={icon} size={12} color={color} style={{ marginRight: 5 }} />
          <Text
            className="text-sm"
            numberOfLines={1}
            style={{
              color: conversation.status === 'empty' ? '#FFC300' : c.textSecondary,
            }}>
            {label}
            {timeLabel ? ` · ${timeLabel}` : ''}
            {streak && streak.count > 1 ? ` · ${streak.count}🔥` : ''}
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
        className="w-9 h-9 rounded-full items-center justify-center">
        <Ionicons name="camera-outline" size={22} color={c.icon} />
      </Pressable>
    </Pressable>
  );
}
