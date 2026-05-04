import React from 'react';
import { Stack } from 'expo-router';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function GroupLayout() {
  const c = useThemeColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="[groupId]/index" />
      <Stack.Screen name="[groupId]/settings" />
      <Stack.Screen name="[groupId]/members" />
    </Stack>
  );
}
