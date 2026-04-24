import React from 'react';
import { View, Text } from 'react-native';
import { useStreak } from '../hooks/useStreak';

interface Props {
  userId1: string;
  userId2: string;
}

export function StreakBadge({ userId1, userId2 }: Props) {
  const streak = useStreak(userId1, userId2);

  if (!streak || streak.count < 2) return null;

  const hoursLeft = Math.floor(streak.ttlSeconds / 3600);

  return (
    <View className="flex-row items-center gap-1">
      <Text className={`text-base ${streak.isWarning ? 'text-yellow-400' : ''}`}>
        {streak.isWarning ? '⏳' : '🔥'}
      </Text>
      <Text className="text-white text-sm font-semibold">{streak.count}</Text>
      {streak.isWarning && (
        <Text className="text-yellow-400 text-xs">{hoursLeft}h</Text>
      )}
    </View>
  );
}
