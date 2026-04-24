import React from 'react';
import { View, Pressable } from 'react-native';
import { useCameraStore } from '../store/cameraStore';

const COLORS = [
  '#FFFC00',
  '#FFFFFF',
  '#000000',
  '#FF3B30',
  '#FF6B35',
  '#34C759',
  '#007AFF',
  '#AF52DE',
  '#FF9F0A',
];

const STROKE_SIZES = [4, 8, 12];

export function DrawingToolbar() {
  const { drawingColor, setDrawingColor, drawingStrokeWidth, setDrawingStrokeWidth } =
    useCameraStore();

  function cycleStroke() {
    const idx = STROKE_SIZES.indexOf(drawingStrokeWidth);
    setDrawingStrokeWidth(STROKE_SIZES[(idx + 1) % STROKE_SIZES.length]);
  }

  return (
    <View
      style={{
        position: 'absolute',
        right: 12,
        top: 100,
        alignItems: 'center',
        gap: 8,
      }}>
      <Pressable
        onPress={cycleStroke}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <View
          style={{
            width: drawingStrokeWidth * 1.5,
            height: drawingStrokeWidth * 1.5,
            borderRadius: drawingStrokeWidth,
            backgroundColor: drawingColor,
          }}
        />
      </Pressable>

      {COLORS.map((color) => {
        const active = drawingColor === color;
        return (
          <Pressable
            key={color}
            onPress={() => setDrawingColor(color)}
            style={{
              width: active ? 34 : 26,
              height: active ? 34 : 26,
              borderRadius: 17,
              backgroundColor: color,
              borderWidth: active ? 3 : 1,
              borderColor: active ? '#fff' : 'rgba(255,255,255,0.4)',
            }}
          />
        );
      })}
    </View>
  );
}
