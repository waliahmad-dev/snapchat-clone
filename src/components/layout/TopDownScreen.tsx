import React, { useCallback, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { SCREEN_HEIGHT } from '@constants/dimensions';

const OPEN_DURATION = 260;
const CLOSE_DURATION = 220;
const DISMISS_COMMIT = 90;        
const DISMISS_VELOCITY = 800;     

interface Props {
  children: React.ReactNode;
  background?: string;
}

export function TopDownScreen({ children, background = '#fff' }: Props) {
  const router = useRouter();
  const translateY = useSharedValue(-SCREEN_HEIGHT);

  useEffect(() => {
    translateY.value = withTiming(0, {
      duration: OPEN_DURATION,
      easing: Easing.out(Easing.cubic),
    });
  }, []);

  const close = useCallback(() => {
    translateY.value = withTiming(
      -SCREEN_HEIGHT,
      { duration: CLOSE_DURATION, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(router.back)();
      },
    );
  }, [router, translateY]);

  const panGesture = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      'worklet';
      translateY.value = Math.min(0, e.translationY);
    })
    .onEnd((e) => {
      'worklet';
      const shouldClose =
        e.translationY < -DISMISS_COMMIT || e.velocityY < -DISMISS_VELOCITY;
      if (shouldClose) {
        translateY.value = withTiming(
          -SCREEN_HEIGHT,
          { duration: CLOSE_DURATION, easing: Easing.in(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(router.back)();
          },
        );
      } else {
        translateY.value = withTiming(0, {
          duration: 180,
          easing: Easing.out(Easing.cubic),
        });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[styles.sheet, { backgroundColor: background }, sheetStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
  },
});
