import { View, Text } from 'react-native';
import { Link } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-black">
      <Text className="text-white text-xl mb-4">Screen not found</Text>
      <Link href="/(app)/camera" className="text-snap-yellow text-base">
        Go home
      </Link>
    </View>
  );
}
