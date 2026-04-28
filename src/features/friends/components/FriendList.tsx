import React from 'react';
import { FlatList, View, Text } from 'react-native';
import { FriendRow } from './FriendRow';
import type { FriendWithStatus } from '../hooks/useFriends';
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  friends: FriendWithStatus[];
  onFriendPress: (friend: FriendWithStatus) => void;
}

export function FriendList({ friends, onFriendPress }: Props) {
  const c = useThemeColors();

  if (friends.length === 0) {
    return (
      <View className="items-center py-10 px-8">
        <Text className="text-3xl mb-3">👻</Text>
        <Text className="font-bold mb-1" style={{ color: c.textPrimary }}>
          No friends yet
        </Text>
        <Text className="text-sm text-center" style={{ color: c.textSecondary }}>
          Search for people to add as friends.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={friends}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <FriendRow friend={item} onPress={() => onFriendPress(item)} />
      )}
    />
  );
}
