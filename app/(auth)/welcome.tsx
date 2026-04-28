import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function WelcomeScreen() {
  const router = useRouter();
  const c = useThemeColors();

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.bg }}>
      <View className="flex-1 items-center justify-center px-8">
        <View
          className="w-24 h-24 rounded-full items-center justify-center mb-8"
          style={{ backgroundColor: c.accent }}>
          <Text className="text-5xl">👻</Text>
        </View>

        <Text className="text-4xl font-bold mb-2" style={{ color: c.textPrimary }}>
          Snapchat
        </Text>
        <Text className="text-base mb-16 text-center" style={{ color: c.textSecondary }}>
          Share the moment. It disappears.
        </Text>

        <Pressable
          onPress={() => router.push('/(auth)/signup')}
          className="w-full rounded-full py-4 items-center mb-4"
          style={{ backgroundColor: c.accent }}>
          <Text className="font-bold text-base" style={{ color: c.accentText }}>
            Sign Up
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(auth)/login')}
          className="w-full rounded-full py-4 items-center border"
          style={{ borderColor: c.border }}>
          <Text className="font-semibold text-base" style={{ color: c.textPrimary }}>
            Log In
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
