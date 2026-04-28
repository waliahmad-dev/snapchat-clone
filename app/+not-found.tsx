import { View, Text } from 'react-native';
import { Link } from 'expo-router';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function NotFoundScreen() {
  const c = useThemeColors();
  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ backgroundColor: c.bg }}>
      <Text className="text-xl mb-4" style={{ color: c.textPrimary }}>
        Screen not found
      </Text>
      <Link href="/(app)/camera" className="text-base" style={{ color: c.accent }}>
        Go home
      </Link>
    </View>
  );
}
