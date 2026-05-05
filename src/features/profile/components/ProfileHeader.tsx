import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@components/ui/Avatar';
import { SnapScore } from './SnapScore';
import { useThemeColors } from '@lib/theme/useThemeColors';
import type { DbUser } from '@/types/database';

interface Props {
  profile: DbUser;
  friendCount: number;
  onAvatarPress?: () => void;
  editable?: boolean;
}

export function ProfileHeader({ profile, friendCount, onAvatarPress, editable = false }: Props) {
  const c = useThemeColors();
  const { t } = useTranslation();
  return (
    <View className="items-center py-6">
      <Pressable onPress={editable ? onAvatarPress : undefined} className="relative">
        <Avatar uri={profile.avatar_url} name={profile.display_name} size={96} />
        {editable && (
          <View
            className="absolute bottom-0 right-0 w-7 h-7 rounded-full border-2 items-center justify-center"
            style={{ backgroundColor: c.surfaceElevated, borderColor: c.bg }}>
            <Text className="text-xs">✏️</Text>
          </View>
        )}
      </Pressable>

      <Text className="text-xl font-bold mt-3" style={{ color: c.textPrimary }}>
        {profile.display_name}
      </Text>
      <Text className="text-sm mt-0.5" style={{ color: c.textSecondary }}>
        @{profile.username}
      </Text>

      <View
        className="flex-row justify-around w-full px-8 mt-5 py-4 mx-4 rounded-xl"
        style={{ backgroundColor: c.surfaceElevated }}>
        <SnapScore userId={profile.id} initialScore={profile.snap_score} />
        <View style={{ width: 1, backgroundColor: c.border }} />
        <View className="items-center">
          <Text className="font-bold text-xl" style={{ color: c.textPrimary }}>
            {friendCount}
          </Text>
          <Text className="text-xs" style={{ color: c.textSecondary }}>
            {t('profile.friendsLabel')}
          </Text>
        </View>
      </View>
    </View>
  );
}
