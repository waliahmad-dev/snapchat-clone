import React from 'react';
import { View, Text } from 'react-native';
import { useStreak } from '../hooks/useStreak';
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  userId1: string;
  userId2: string;
}

export function StreakBadge({ userId1, userId2 }: Props) {
  const c = useThemeColors();
  const streak = useStreak(userId1, userId2);

  if (!streak || streak.count < 2) return null;

  const hoursLeft = Math.floor(streak.ttlSeconds / 3600);
  const warning = '#FACC15';

  return (
    <View className="flex-row items-center gap-1">
      <Text className="text-base">{streak.isWarning ? '⏳' : '🔥'}</Text>
      <Text className="text-sm font-semibold" style={{ color: c.textPrimary }}>
        {streak.count}
      </Text>
      {streak.isWarning && (
        <Text className="text-xs" style={{ color: warning }}>
          {hoursLeft}h
        </Text>
      )}
    </View>
  );
}
