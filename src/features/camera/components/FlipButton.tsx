import React from 'react';
import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  onPress: () => void;
}

export function FlipButton({ onPress }: Props) {
  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={6}
      className="w-12 h-12 rounded-full bg-black/40 items-center justify-center">
      <Ionicons name="camera-reverse" size={26} color="#fff" />
    </Pressable>
  );
}
