import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

interface Props {
  progress: number;
  color?: string;
  height?: number;
  animated?: boolean;
}

export function ProgressBar({
  progress,
  color = '#FFFC00',
  height = 4,
  animated = true,
}: Props) {
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

  return (
    <View
      style={{ height, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: height / 2 }}
      className="w-full overflow-hidden">
      <Animated.View
        style={[{ height, borderRadius: height / 2, backgroundColor: color }, style]}
      />
    </View>
  );
}
