import { Stack } from 'expo-router';

const SHEET_TRANSITION = {
  animation: 'slide_from_bottom' as const,
  animationDuration: 240,
  gestureEnabled: true,
  gestureDirection: 'vertical' as const,
};

const PUSH_TRANSITION = {
  animation: 'slide_from_right' as const,
  animationDuration: 220,
  gestureEnabled: true,
};

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
      <Stack.Screen name="camera" options={{ animation: 'none' }} />

      <Stack.Screen name="chat" options={PUSH_TRANSITION} />
      <Stack.Screen name="stories" options={{ animation: 'fade', animationDuration: 180 }} />

      <Stack.Screen name="profile/index" options={{ animation: 'none' }} />
      <Stack.Screen name="profile/[userId]" options={PUSH_TRANSITION} />
      <Stack.Screen name="search/index" options={SHEET_TRANSITION} />
      <Stack.Screen name="memories/index" options={SHEET_TRANSITION} />
      <Stack.Screen name="settings" options={PUSH_TRANSITION} />
    </Stack>
  );
}
