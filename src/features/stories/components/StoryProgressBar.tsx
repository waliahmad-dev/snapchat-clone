import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

interface Props {
  count: number;
  currentIndex: number;
  duration: number;
  paused?: boolean;
  onComplete: () => void;
}

export function StoryProgressBar({
  count,
  currentIndex,
  duration,
  paused = false,
  onComplete,
}: Props) {
  const progress = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const segmentStartRef = useRef<number>(0);
  const remainingRef = useRef<number>(duration);
  const initializedRef = useRef(false);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => {
    clearTimer();
    cancelAnimation(progress);
    progress.value = 0;
    remainingRef.current = duration;
    segmentStartRef.current = Date.now();

    if (!paused) {
      progress.value = withTiming(1, { duration, easing: Easing.linear });
      timerRef.current = setTimeout(onComplete, duration);
    }

    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, duration]);

  useEffect(() => {
    // Skip the initial run — the [currentIndex, duration] effect above
    // already scheduled the first timer. Without this guard, mount would
    // schedule a duplicate timer that the pause path can't cancel,
    // causing a stale onComplete (goNext → onClose on the last story).
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    if (paused) {
      const elapsed = Date.now() - segmentStartRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
      cancelAnimation(progress);
      clearTimer();
    } else {
      const remaining = remainingRef.current;
      if (remaining <= 0) return;
      segmentStartRef.current = Date.now();
      progress.value = withTiming(1, { duration: remaining, easing: Easing.linear });
      timerRef.current = setTimeout(onComplete, remaining);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

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
