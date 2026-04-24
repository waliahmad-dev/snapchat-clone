import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { useAuthStore } from '@features/auth/store/authStore';

interface Props {
  title: string;
  onAddFriendPress?: () => void;
  onMorePress?: () => void;
}

export function TopBar({ title, onAddFriendPress, onMorePress }: Props) {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);

  return (
    <View className="flex-row items-center px-4 pt-2 pb-3 bg-white">
      <Pressable onPress={() => router.push('/(app)/profile')} hitSlop={8}>
        <Avatar
          uri={profile?.avatar_url}
          name={profile?.display_name ?? '?'}
          size={34}
        />
      </Pressable>

      <Text className="flex-1 text-center text-black font-bold text-lg">
        {title}
      </Text>

      <Pressable
        onPress={onAddFriendPress ?? (() => router.push('/(app)/search'))}
        hitSlop={6}
        className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center">
        <Ionicons name="person-add" size={18} color="#111" />
      </Pressable>

      <Pressable
        onPress={onMorePress ?? (() => router.push('/(app)/settings'))}
        hitSlop={6}
        className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center ml-2">
        <Ionicons name="ellipsis-horizontal" size={18} color="#111" />
      </Pressable>
    </View>
  );
}
