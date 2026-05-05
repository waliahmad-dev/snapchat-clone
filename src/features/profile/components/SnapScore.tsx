import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSnapScore } from '../hooks/useSnapScore';
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  userId?: string;
  initialScore?: number;
}

export function SnapScore({ userId, initialScore = 0 }: Props) {
  const c = useThemeColors();
  const { t } = useTranslation();
  const score = useSnapScore(userId);
  const displayScore = score || initialScore;

  return (
    <View className="items-center">
      <Text className="font-bold text-xl" style={{ color: c.textPrimary }}>
        {displayScore.toLocaleString()}
      </Text>
      <Text className="text-xs" style={{ color: c.textSecondary }}>
        {t('profile.snapScore')}
      </Text>
    </View>
  );
}
