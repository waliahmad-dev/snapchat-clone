import React from 'react';
import { View, Image, Text } from 'react-native';
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  uri?: string | null;
  name: string;
  size?: number;
}

export function Avatar({ uri, name, size = 48 }: Props) {
  const c = useThemeColors();
  const fontSize = size * 0.4;
  const style = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (uri) {
    return <Image source={{ uri }} style={style} />;
  }

  return (
    <View
      style={[style, { backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ fontSize, fontWeight: 'bold', color: c.accentText }}>
        {name[0]?.toUpperCase() ?? '?'}
      </Text>
    </View>
  );
}
