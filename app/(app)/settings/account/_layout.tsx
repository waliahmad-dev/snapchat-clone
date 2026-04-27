import { Stack } from 'expo-router';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function AccountSettingsLayout() {
  const c = useThemeColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="name" />
      <Stack.Screen name="username" />
      <Stack.Screen name="birthday" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="email" />
      <Stack.Screen name="password" />
      <Stack.Screen name="delete" />
    </Stack>
  );
}
