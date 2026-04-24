import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  pendingCount: number;
}

export function MemoryUploadProgress({ pendingCount }: Props) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (pendingCount > 0) {
      opacity.value = withRepeat(withTiming(0.3, { duration: 600 }), -1, true);
    } else {
      opacity.value = withTiming(1, { duration: 200 });
    }
  }, [pendingCount]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (pendingCount === 0) return null;

  return (
    <Animated.View
      style={animStyle}
      className="flex-row items-center gap-2 bg-snap-surface rounded-full px-3 py-1.5 self-end mr-4 mb-2">
      <View className="w-2 h-2 rounded-full bg-snap-yellow" />
      <Text className="text-white text-xs">
        Uploading {pendingCount} {pendingCount === 1 ? 'memory' : 'memories'}…
      </Text>
    </Animated.View>
  );
}
