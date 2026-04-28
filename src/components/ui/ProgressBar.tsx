import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  progress: number;
  color?: string;
  height?: number;
  animated?: boolean;
}

export function ProgressBar({ progress, color, height = 4, animated = true }: Props) {
  const c = useThemeColors();
  const width = useSharedValue(0);

  useEffect(() => {
    if (animated) {
      width.value = withTiming(progress, { duration: 300 });
    } else {
      width.value = progress;
    }
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  const fillColor = color ?? c.accent;
  const trackColor = c.scheme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';

  return (
    <View
      style={{ height, backgroundColor: trackColor, borderRadius: height / 2 }}
      className="w-full overflow-hidden">
      <Animated.View
        style={[{ height, borderRadius: height / 2, backgroundColor: fillColor }, style]}
      />
    </View>
  );
}
