import React from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Path, type SkPath } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useCameraStore } from '../store/cameraStore';

interface CompletedPath {
  path: SkPath;
  color: string;
  strokeWidth: number;
}

interface ActivePath {
  path: SkPath;
  color: string;
  strokeWidth: number;
}

interface Props {
  completedPaths: CompletedPath[];
  activePath: ActivePath | null;
  onTouchStart: (x: number, y: number) => void;
  onTouchMove: (x: number, y: number) => void;
  onTouchEnd: () => void;
}

export function SkiaCanvas({
  completedPaths,
  activePath,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: Props) {
  const { drawingMode } = useCameraStore();

  const panGesture = Gesture.Pan()
    .enabled(drawingMode)
    .runOnJS(true)
    .onStart((e) => onTouchStart(e.x, e.y))
    .onUpdate((e) => onTouchMove(e.x, e.y))
    .onEnd(() => onTouchEnd());

  return (
    <GestureDetector gesture={panGesture}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents={drawingMode ? 'auto' : 'none'}>
        {completedPaths.map((p, i) => (
          <Path
            key={i}
            path={p.path}
            color={p.color}
            style="stroke"
            strokeWidth={p.strokeWidth}
            strokeCap="round"
            strokeJoin="round"
          />
        ))}
        {activePath && (
          <Path
            path={activePath.path}
            color={activePath.color}
            style="stroke"
            strokeWidth={activePath.strokeWidth}
            strokeCap="round"
            strokeJoin="round"
          />
        )}
      </Canvas>
    </GestureDetector>
  );
}
