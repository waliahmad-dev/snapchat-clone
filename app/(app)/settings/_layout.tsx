import React from 'react';
import { Stack } from 'expo-router';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function SettingsLayout() {
  const c = useThemeColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="appearance" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="blocked" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="storage" />
      <Stack.Screen name="account" />
    </Stack>
  );
}
