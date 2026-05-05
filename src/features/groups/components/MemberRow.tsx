import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@components/ui/Avatar';
import { useThemeColors } from '@lib/theme/useThemeColors';
import type { GroupMemberWithUser } from '../hooks/useGroupMembers';

interface Props {
  member: GroupMemberWithUser;
  rightSlot?: React.ReactNode;
}

export function MemberRow({ member, rightSlot }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const c = useThemeColors();
  const handle = member.user.username ? `@${member.user.username}` : '';

  return (
    <Pressable
      onPress={() =>
        !member.isMe &&
        router.push({
          pathname: '/(app)/profile/[userId]',
          params: { userId: member.user.id },
        })
      }
      android_ripple={{ color: c.rowPress }}
      className="flex-row items-center px-4 py-3">
      <Avatar uri={member.user.avatar_url ?? null} name={member.user.display_name} size={44} />
      <View className="mx-3 flex-1">
        <View className="flex-row items-center">
          <Text
            className="text-base font-semibold"
            style={{ color: c.textPrimary }}
            numberOfLines={1}>
            {member.user.display_name}
            {member.isMe ? t('chat.group.memberRow.youSuffix') : ''}
          </Text>
        </View>
        <Text className="text-sm" style={{ color: c.textSecondary }}>
          {handle}
        </Text>
      </View>
      {rightSlot}
    </Pressable>
  );
}
