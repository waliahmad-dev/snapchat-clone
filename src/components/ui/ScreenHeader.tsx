import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  title: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  variant?: 'light' | 'dark';
}

export function ScreenHeader({ title, onBack, rightSlot, variant = 'light' }: Props) {
  const router = useRouter();
  const isDark = variant === 'dark';

  const bg = isDark ? 'bg-black' : 'bg-white';
  const titleColor = isDark ? 'text-white' : 'text-black';
  const iconColor = isDark ? '#fff' : '#111';

  return (
    <SafeAreaView edges={['top']} className={bg}>
      <View className="flex-row items-center px-4 pt-2 pb-3">
        <Pressable
          onPress={onBack ?? (() => router.back())}
          hitSlop={10}
          className="w-9 h-9 items-center justify-center">
          <Ionicons name="chevron-back" size={26} color={iconColor} />
        </Pressable>

        <Text
          className={`flex-1 text-center font-bold text-lg ${titleColor}`}
          numberOfLines={1}>
          {title}
        </Text>

        <View className="w-9 h-9 items-center justify-center">{rightSlot}</View>
      </View>
    </SafeAreaView>
  );
}
