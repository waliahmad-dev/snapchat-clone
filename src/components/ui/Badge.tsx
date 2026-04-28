import React from 'react';
import { View, Text } from 'react-native';
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  count: number;
  color?: string;
  size?: 'sm' | 'md';
}

export function Badge({ count, color, size = 'sm' }: Props) {
  const c = useThemeColors();
  if (count <= 0) return null;

  const dimension = size === 'sm' ? 16 : 20;
  const fontSize = size === 'sm' ? 9 : 11;
  const bg = color ?? c.accent;

  return (
    <View
      style={{
        width: dimension,
        height: dimension,
        borderRadius: dimension / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
        top: -4,
        right: -4,
      }}>
      <Text style={{ fontSize, fontWeight: 'bold', color: c.accentText }}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}
