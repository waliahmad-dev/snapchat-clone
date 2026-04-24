import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  active: boolean;
  color?: string;
}


export function BreathingLoader({ active, color = '#FFFC00' }: Props) {
  const sweepX = useSharedValue(-1);    
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      opacity.value = withTiming(1, { duration: 180 });
      sweepX.value = withRepeat(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }),
        -1,
        false,
      );
    } else {
      opacity.value = withTiming(0, { duration: 220 });
      cancelAnimation(sweepX);
      sweepX.value = -1;
    }
  }, [active, opacity, sweepX]);

  const trackStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${sweepX.value * 100}%` as unknown as number }],
  }));

  return (
    <Animated.View style={[styles.track, trackStyle]} pointerEvents="none">
      <View style={styles.railBg} />
      <Animated.View
        style={[styles.sweep, { backgroundColor: color }, sweepStyle]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 2.5,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  railBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  sweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '40%',
    borderRadius: 2,
  },
});
