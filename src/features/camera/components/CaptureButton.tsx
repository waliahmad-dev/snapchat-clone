import React from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface Props {
  onPress: () => void;
  disabled?: boolean;
}

export function CaptureButton({ onPress, disabled = false }: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    if (disabled) return;
    scale.value = withSequence(withSpring(0.85), withSpring(1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  }

  return (
    <Pressable onPress={handlePress} disabled={disabled} className="items-center justify-center">
      <Animated.View style={animatedStyle}>
        <View className="w-20 h-20 rounded-full border-4 border-white items-center justify-center">
          <View className="w-16 h-16 rounded-full bg-white" />
        </View>
      </Animated.View>
    </Pressable>
  );
}
