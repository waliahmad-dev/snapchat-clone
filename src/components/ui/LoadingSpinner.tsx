import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  size?: 'small' | 'large';
  fullScreen?: boolean;
}

export function LoadingSpinner({ size = 'large', fullScreen = false }: Props) {
  const c = useThemeColors();
  if (fullScreen) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: c.bg }}>
        <ActivityIndicator color={c.accent} size={size} />
      </View>
    );
  }
  return <ActivityIndicator color={c.accent} size={size} />;
}
