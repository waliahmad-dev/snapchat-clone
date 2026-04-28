import { Stack } from 'expo-router';
import { useThemeColors } from '@lib/theme/useThemeColors';

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
  const c = useThemeColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
        contentStyle: { backgroundColor: c.bg },
      }}>
      <Stack.Screen
        name="camera"
        options={{ animation: 'none', contentStyle: { backgroundColor: '#000000' } }}
      />

      <Stack.Screen name="chat" options={PUSH_TRANSITION} />
      <Stack.Screen
        name="stories"
        options={{
          animation: 'fade',
          animationDuration: 180,
          contentStyle: { backgroundColor: '#000000' },
        }}
      />

      <Stack.Screen name="profile/index" options={{ animation: 'none' }} />
      <Stack.Screen name="profile/[userId]" options={PUSH_TRANSITION} />
      <Stack.Screen name="search/index" options={SHEET_TRANSITION} />
      <Stack.Screen name="memories/index" options={SHEET_TRANSITION} />
      <Stack.Screen name="settings" options={PUSH_TRANSITION} />
    </Stack>
  );
}
