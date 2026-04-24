import React from 'react';
import { View, ActivityIndicator } from 'react-native';

interface Props {
  size?: 'small' | 'large';
  fullScreen?: boolean;
}

export function LoadingSpinner({ size = 'large', fullScreen = false }: Props) {
  if (fullScreen) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator color="#FFFC00" size={size} />
      </View>
    );
  }
  return <ActivityIndicator color="#FFFC00" size={size} />;
}
