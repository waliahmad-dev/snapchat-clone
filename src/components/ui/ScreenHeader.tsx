import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  title: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
}

export function ScreenHeader({ title, onBack, rightSlot }: Props) {
  const router = useRouter();
  const c = useThemeColors();

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: c.bg }}>
      <View className="flex-row items-center px-4 pt-2 pb-3">
        <Pressable
          onPress={onBack ?? (() => router.back())}
          hitSlop={10}
          className="w-9 h-9 items-center justify-center">
          <Ionicons name="chevron-back" size={26} color={c.icon} />
        </Pressable>

        <Text
          className="flex-1 text-center font-bold text-lg"
          style={{ color: c.textPrimary }}
          numberOfLines={1}>
          {title}
        </Text>

        <View className="w-9 h-9 items-center justify-center">{rightSlot}</View>
      </View>
    </SafeAreaView>
  );
}
