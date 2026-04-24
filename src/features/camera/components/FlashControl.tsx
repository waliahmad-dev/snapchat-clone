import React from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CameraFlash } from '@features/camera/store/cameraStore';

interface Props {
  flash: CameraFlash;
  onToggle: () => void;
}

export function FlashControl({ flash, onToggle }: Props) {
  const isOn = flash === 'on';

  return (
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      className="w-10 h-10 rounded-full bg-black/40 items-center justify-center">
      <Ionicons
        name={isOn ? 'flash' : 'flash-off'}
        size={20}
        color={isOn ? '#FFFC00' : '#fff'}
      />
    </Pressable>
  );
}
