import React from 'react';
import { View, Text } from 'react-native';
import { useSnapScore } from '../hooks/useSnapScore';

interface Props {
  userId?: string;
  initialScore?: number;
}

export function SnapScore({ userId, initialScore = 0 }: Props) {
  const score = useSnapScore(userId);
  const displayScore = score || initialScore;

  return (
    <View className="items-center">
      <Text className="text-white font-bold text-xl">
        {displayScore.toLocaleString()}
      </Text>
      <Text className="text-snap-gray text-xs">Snap Score</Text>
    </View>
  );
}
