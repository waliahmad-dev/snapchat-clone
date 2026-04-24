import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface Props {
  count: number;
  currentIndex: number;
  duration: number; 
  onComplete: () => void;
}

export function StoryProgressBar({ count, currentIndex, duration, onComplete }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, {
      duration,
      easing: Easing.linear,
    });

    const timer = setTimeout(onComplete, duration);
    return () => {
      clearTimeout(timer);
    };
  }, [currentIndex, duration]);

  const animStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View className="flex-row gap-1 px-2">
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
          {i < currentIndex && (
            <View className="h-full bg-white rounded-full" style={{ width: '100%' }} />
          )}
          {i === currentIndex && (
            <Animated.View className="h-full bg-white rounded-full" style={animStyle} />
          )}
        </View>
      ))}
    </View>
  );
}
