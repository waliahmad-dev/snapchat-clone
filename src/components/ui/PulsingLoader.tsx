import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  label?: string;
}

export function PulsingLoader({ label }: Props) {
  const pulse = useSharedValue(0.4);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.ring}>
        <Animated.View style={[styles.core, pulseStyle]} />
      </View>
      {label ? (
        <Animated.Text style={[styles.text, pulseStyle]}>{label}</Animated.Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  ring: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: 'rgba(255,252,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFC00',
  },
  text: {
    color: '#FFFC00',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
