import React from 'react';
import { StyleSheet } from 'react-native';
import { CameraView } from 'expo-camera';
import type { RefObject } from 'react';
import type { CameraFacing, CameraFlash } from '@features/camera/store/cameraStore';

interface Props {
  cameraRef: RefObject<CameraView | null>;
  facing: CameraFacing;
  flash: CameraFlash;
  zoom: number;
}

export function CameraViewComponent({ cameraRef, facing, flash, zoom }: Props) {
  const safeFlash: 'on' | 'off' | 'auto' =
    flash === 'torch' ? 'on' : flash;
  return (
    <CameraView
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      facing={facing}
      flash={safeFlash}
      zoom={zoom}
    />
  );
}
