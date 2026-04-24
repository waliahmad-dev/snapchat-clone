import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Avatar } from '@components/ui/Avatar';
import type { FriendWithStatus } from '../hooks/useFriends';

interface Props {
  friend: FriendWithStatus;
  onPress?: () => void;
  trailing?: React.ReactNode;
}

export function FriendRow({ friend, onPress, trailing }: Props) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3 border-b border-white/5">
      <Avatar uri={friend.avatar_url} name={friend.display_name} size={44} />
      <View className="flex-1 ml-3">
        <Text className="text-white font-semibold">{friend.display_name}</Text>
        <Text className="text-snap-gray text-sm">@{friend.username}</Text>
      </View>
      {trailing}
    </Pressable>
  );
}
