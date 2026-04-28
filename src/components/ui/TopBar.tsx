import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { useAuthStore } from '@features/auth/store/authStore';
import { useThemeColors } from '@lib/theme/useThemeColors';
import { useFriendRequestCount } from '@features/friends/hooks/useFriendRequestCount';

interface Props {
  title: string;
  onAddFriendPress?: () => void;
  onMorePress?: () => void;
}

export function TopBar({ title, onAddFriendPress, onMorePress }: Props) {
  const router = useRouter();
  const c = useThemeColors();
  const profile = useAuthStore((s) => s.profile);
  const requestCount = useFriendRequestCount();

  return (
    <View
      className="flex-row items-center px-4 pt-2 pb-3"
      style={{ backgroundColor: c.bg }}>
      <Pressable onPress={() => router.push('/(app)/profile')} hitSlop={8}>
        <Avatar uri={profile?.avatar_url} name={profile?.display_name ?? '?'} size={34} />
      </Pressable>

      <Text
        className="flex-1 text-center font-bold text-lg"
        style={{ color: c.textPrimary }}>
        {title}
      </Text>

      <Pressable
        onPress={onAddFriendPress ?? (() => router.push('/(app)/search'))}
        hitSlop={6}
        className="w-9 h-9 rounded-full items-center justify-center"
        style={{ backgroundColor: c.iconCircleBg }}>
        <Ionicons name="person-add" size={18} color={c.icon} />
        {requestCount > 0 && (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: c.danger,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 5,
              borderWidth: 1.5,
              borderColor: c.bg,
            }}>
            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
              {requestCount > 99 ? '99+' : requestCount}
            </Text>
          </View>
        )}
      </Pressable>

      <Pressable
        onPress={onMorePress ?? (() => router.push('/(app)/settings'))}
        hitSlop={6}
        className="w-9 h-9 rounded-full items-center justify-center ml-2"
        style={{ backgroundColor: c.iconCircleBg }}>
        <Ionicons name="ellipsis-horizontal" size={18} color={c.icon} />
      </Pressable>
    </View>
  );
}
