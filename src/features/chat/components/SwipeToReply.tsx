import React, { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  isOwn: boolean;
  onTriggerReply: () => void;
  children: ReactNode;
}

const TRIGGER_DISTANCE = 64;
const MAX_TRANSLATE = 90;

export function SwipeToReply({ isOwn, onTriggerReply, children }: Props) {
  const c = useThemeColors();
  const translateX = useSharedValue(0);
  const passedThreshold = useSharedValue(false);
  const sign = isOwn ? -1 : 1;

  function fireHaptic() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  const pan = Gesture.Pan()
    .activeOffsetX(isOwn ? [-12, 99999] : [-99999, 12])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      'worklet';
      const intent = e.translationX * sign;
      if (intent <= 0) {
        translateX.value = 0;
        return;
      }
      const eased =
        intent > MAX_TRANSLATE
          ? MAX_TRANSLATE + (intent - MAX_TRANSLATE) * 0.25
          : intent;
      translateX.value = eased * sign;

      const reached = intent >= TRIGGER_DISTANCE;
      if (reached && !passedThreshold.value) {
        passedThreshold.value = true;
        runOnJS(fireHaptic)();
      } else if (!reached && passedThreshold.value) {
        passedThreshold.value = false;
      }
    })
    .onEnd(() => {
      'worklet';
      const fired = passedThreshold.value;
      passedThreshold.value = false;
      translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
      if (fired) runOnJS(onTriggerReply)();
    });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const iconStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(translateX.value) / TRIGGER_DISTANCE, 1);
    return {
      opacity: progress,
      transform: [{ scale: interpolate(progress, [0, 1], [0.6, 1]) }],
    };
  });

  return (
    <View style={styles.wrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.iconWrap,
          isOwn ? styles.iconRight : styles.iconLeft,
          iconStyle,
        ]}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: c.surfaceElevated, borderColor: c.divider },
          ]}>
          <Ionicons name="arrow-undo" size={16} color={c.icon} />
        </View>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={containerStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  iconWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: { left: 8 },
  iconRight: { right: 8 },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
