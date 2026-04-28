import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  pendingCount: number;
}

export function MemoryUploadProgress({ pendingCount }: Props) {
  const c = useThemeColors();
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
      style={[animStyle, { backgroundColor: c.surfaceElevated }]}
      className="flex-row items-center gap-2 rounded-full px-3 py-1.5 self-end mr-4 mb-2">
      <View
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: c.accent }}
      />
      <Text className="text-xs" style={{ color: c.textPrimary }}>
        Uploading {pendingCount} {pendingCount === 1 ? 'memory' : 'memories'}…
      </Text>
    </Animated.View>
  );
}
