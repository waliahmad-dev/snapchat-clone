import { Stack } from 'expo-router';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function AuthLayout() {
  const c = useThemeColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
