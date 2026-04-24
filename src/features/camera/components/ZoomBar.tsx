import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export const ZOOM_CEILING = Platform.OS === 'ios' ? 0.18 : 0.35;

const ALL_PRESETS = [
  { key: 'one',  label: '1',  value: 0 },
  { key: 'five', label: '5',  value: ZOOM_CEILING },
] as const;


interface Props {
  zoom: number;
  preset: 'half' | 'one' | 'five';
  onSelect: (preset: 'half' | 'one' | 'five') => void;
}

export function ZoomBar({ zoom, preset, onSelect }: Props) {
  function select(key: 'half' | 'one' | 'five') {
    Haptics.selectionAsync();
    onSelect(key);
  }

  return (
    <View className="flex-row bg-black/40 rounded-full py-1.5 px-1.5 gap-1">
      {ALL_PRESETS.map((p) => {
        const isActive = p.key === preset;
        return (
          <Pressable
            key={p.key}
            onPress={() => select(p.key)}
            className={`rounded-full items-center justify-center ${isActive ? 'bg-white' : ''}`}
            style={{ width: 38, height: 38 }}>
            <Text
              className={`font-bold ${isActive ? 'text-black' : 'text-snap-yellow'}`}
              style={{ fontSize: isActive ? 11 : 13 }}>
              {isActive ? `${p.label}×` : p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
