import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-24 h-24 bg-snap-yellow rounded-full items-center justify-center mb-8">
          <Text className="text-5xl">👻</Text>
        </View>

        <Text className="text-white text-4xl font-bold mb-2">Snapchat</Text>
        <Text className="text-snap-gray text-base mb-16 text-center">
          Share the moment. It disappears.
        </Text>

        <Pressable
          onPress={() => router.push('/(auth)/signup')}
          className="w-full bg-snap-yellow rounded-full py-4 items-center mb-4">
          <Text className="text-black font-bold text-base">Sign Up</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(auth)/login')}
          className="w-full border border-white/30 rounded-full py-4 items-center">
          <Text className="text-white font-semibold text-base">Log In</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
