import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Avatar } from '@components/ui/Avatar';
import type { FriendWithStatus } from '../hooks/useFriends';
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  friend: FriendWithStatus;
  onPress?: () => void;
  trailing?: React.ReactNode;
}

export function FriendRow({ friend, onPress, trailing }: Props) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: c.rowPress }}
      className="flex-row items-center px-4 py-3 border-b"
      style={{ borderColor: c.divider }}>
      <Avatar uri={friend.avatar_url} name={friend.display_name} size={44} />
      <View className="flex-1 ml-3">
        <Text className="font-semibold" style={{ color: c.textPrimary }}>
          {friend.display_name}
        </Text>
        <Text className="text-sm" style={{ color: c.textSecondary }}>
          @{friend.username}
        </Text>
      </View>
      {trailing}
    </Pressable>
  );
}
