import { Stack } from 'expo-router';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function ChatLayout() {
  const c = useThemeColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[conversationId]" />
    </Stack>
  );
}
