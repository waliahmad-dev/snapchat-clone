import React from 'react';
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
          className="mb-8 h-24 w-24 items-center justify-center rounded-full"
          style={{ backgroundColor: c.accent }}>
          <Text className="text-5xl">👻</Text>
        </View>

        <Text className="mb-2 text-4xl font-bold" style={{ color: c.textPrimary }}>
          Snapchat
        </Text>
        <Text className="mb-16 text-center text-base" style={{ color: c.textSecondary }}>
          Share the moment. It disappears.
        </Text>

        <Pressable
          onPress={() => router.push('/(auth)/signup')}
          className="mb-4 w-full items-center rounded-full py-4"
          style={{ backgroundColor: c.accent }}>
          <Text className="text-base font-bold" style={{ color: c.accentText }}>
            Sign Up
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(auth)/login')}
          className="w-full items-center rounded-full border py-4"
          style={{ borderColor: c.border }}>
          <Text className="text-base font-semibold" style={{ color: c.textPrimary }}>
            Log In
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
