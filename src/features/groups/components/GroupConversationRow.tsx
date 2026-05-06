import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GroupAvatar } from './GroupAvatar';
import { shortTimeAgo } from '@features/chat/utils/messageHelpers';
import { useNow } from '@hooks/useNow';
import { useThemeColors } from '@lib/theme/useThemeColors';
import { decodeSystemEvent } from '@lib/i18n/systemEvent';
import type { GroupChatSummary } from '../hooks/useGroupChats';

interface Props {
  group: GroupChatSummary;
}

export function GroupConversationRow({ group }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const c = useThemeColors();

  const now = useNow(60_000);
  const fallbackName =
    group.members.slice(0, 3).map((m) => m.display_name.split(' ')[0]).join(', ') ||
    'Group';
  const title = group.name?.trim() || fallbackName;
  const timeLabel = shortTimeAgo(group.lastMessageAt, now);

  const previewIcon: React.ComponentProps<typeof Ionicons>['name'] =
    group.hasUnviewedMedia ? 'camera' : 'chatbubble';
  const previewColor = group.unreadCount > 0 ? '#00C2FF' : c.textMuted;
  // System events ("Alice created the group", "Bob added Carol") are stored
  // as i18n envelopes so each member sees them in their own locale. Decode
  // at render time; fall back to the raw string for normal messages.
  const decoded = decodeSystemEvent(group.lastMessageText);
  const previewText =
    (decoded ? t(decoded.key, decoded.args ?? {}) : group.lastMessageText) ||
    (group.members.length === 0
      ? t('chat.group.row.justYou')
      : t('chat.group.row.sayHi'));

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/(app)/chat/group/[groupId]',
          params: { groupId: group.id, name: title },
        })
      }
      android_ripple={{ color: c.rowPress }}
      className="flex-row items-center px-4 py-3">
      <GroupAvatar members={group.members} avatarUrl={group.avatarUrl} size={48} />

      <View className="mx-3 flex-1">
        <View className="flex-row items-center">
          <Text
            className="flex-shrink text-base font-semibold"
            style={{ color: c.textPrimary }}
            numberOfLines={1}>
            {title}
          </Text>
          <View
            className="ml-2 rounded-full px-1.5 py-[1px]"
            style={{ backgroundColor: c.surfaceElevated }}>
            <Text className="text-[10px] font-bold" style={{ color: c.textSecondary }}>
              {group.members.length + 1}
            </Text>
          </View>
          {group.unreadCount > 0 && (
            <View
              className="ml-2 h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5"
              style={{ backgroundColor: c.danger }}>
              <Text className="text-[10px] font-bold" style={{ color: '#FFFFFF' }}>
                {group.unreadCount > 99 ? '99+' : group.unreadCount}
              </Text>
            </View>
          )}
        </View>
        <View className="mt-0.5 flex-row items-center">
          <Ionicons
            name={previewIcon}
            size={12}
            color={previewColor}
            style={{ marginRight: 5 }}
          />
          <Text
            className="text-sm flex-1"
            numberOfLines={1}
            style={{ color: c.textSecondary }}>
            {previewText}
            {timeLabel ? ` · ${timeLabel}` : ''}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
