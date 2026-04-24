import React from 'react';
import { FlatList, View, Text } from 'react-native';
import { FriendRow } from './FriendRow';
import type { FriendWithStatus } from '../hooks/useFriends';

interface Props {
  friends: FriendWithStatus[];
  onFriendPress: (friend: FriendWithStatus) => void;
}

export function FriendList({ friends, onFriendPress }: Props) {
  if (friends.length === 0) {
    return (
      <View className="items-center py-10 px-8">
        <Text className="text-white text-3xl mb-3">👻</Text>
        <Text className="text-white font-bold mb-1">No friends yet</Text>
        <Text className="text-snap-gray text-sm text-center">
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
