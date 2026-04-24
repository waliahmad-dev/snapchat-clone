import React from 'react';
import { View, Text } from 'react-native';

interface Props {
  count: number;
  color?: string;
  size?: 'sm' | 'md';
}

export function Badge({ count, color = '#FFFC00', size = 'sm' }: Props) {
  if (count <= 0) return null;

  const dimension = size === 'sm' ? 16 : 20;
  const fontSize = size === 'sm' ? 9 : 11;

  return (
    <View
      style={{
        width: dimension,
        height: dimension,
        borderRadius: dimension / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
        top: -4,
        right: -4,
      }}>
      <Text style={{ fontSize, fontWeight: 'bold', color: '#000' }}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}
