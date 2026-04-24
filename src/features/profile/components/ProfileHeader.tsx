import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Avatar } from '@components/ui/Avatar';
import { SnapScore } from './SnapScore';
import type { DbUser } from '@/types/database';

interface Props {
  profile: DbUser;
  friendCount: number;
  onAvatarPress?: () => void;
  editable?: boolean;
}

export function ProfileHeader({ profile, friendCount, onAvatarPress, editable = false }: Props) {
  return (
    <View className="items-center py-6">
      <Pressable onPress={editable ? onAvatarPress : undefined} className="relative">
        <Avatar uri={profile.avatar_url} name={profile.display_name} size={96} />
        {editable && (
          <View className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-snap-surface border-2 border-black items-center justify-center">
            <Text className="text-white text-xs">✏️</Text>
          </View>
        )}
      </Pressable>

      <Text className="text-white text-xl font-bold mt-3">{profile.display_name}</Text>
      <Text className="text-snap-gray text-sm mt-0.5">@{profile.username}</Text>

      <View className="flex-row justify-around w-full px-8 mt-5 py-4 bg-snap-surface mx-4 rounded-xl">
        <SnapScore userId={profile.id} initialScore={profile.snap_score} />
        <View className="w-px bg-white/10" />
        <View className="items-center">
          <Text className="text-white font-bold text-xl">{friendCount}</Text>
          <Text className="text-snap-gray text-xs">Friends</Text>
        </View>
      </View>
    </View>
  );
}
