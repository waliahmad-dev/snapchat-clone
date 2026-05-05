import React from 'react';
import { FlatList, View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FriendRow } from './FriendRow';
import type { FriendWithStatus } from '../hooks/useFriends';
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  friends: FriendWithStatus[];
  onFriendPress: (friend: FriendWithStatus) => void;
}

export function FriendList({ friends, onFriendPress }: Props) {
  const c = useThemeColors();
  const { t } = useTranslation();

  if (friends.length === 0) {
    return (
      <View className="items-center py-10 px-8">
        <Text className="text-3xl mb-3">👻</Text>
        <Text className="font-bold mb-1" style={{ color: c.textPrimary }}>
          {t('search.friends.emptyTitle')}
        </Text>
        <Text className="text-sm text-center" style={{ color: c.textSecondary }}>
          {t('search.friends.emptyBody')}
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
