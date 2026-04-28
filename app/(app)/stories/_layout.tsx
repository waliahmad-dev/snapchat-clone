import { Stack } from 'expo-router';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function StoriesLayout() {
  const c = useThemeColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[storyId]"
        options={{
          presentation: 'fullScreenModal',
          contentStyle: { backgroundColor: '#000000' },
        }}
      />
    </Stack>
  );
}
