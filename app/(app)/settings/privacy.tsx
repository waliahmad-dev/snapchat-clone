import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Switch, Alert, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';
import type { DbUser } from '@/types/database';

export default function PrivacyScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const [blockedUsers, setBlockedUsers] = useState<DbUser[]>([]);
  const [showBlocked, setShowBlocked] = useState(false);

  async function loadBlockedUsers() {
    if (!profile) return;
    const { data: blocks } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', profile.id);

    if (!blocks?.length) return;
    const ids = blocks.map((b: { blocked_id: string }) => b.blocked_id);
    const { data: users } = await supabase.from('users').select('*').in('id', ids);
    setBlockedUsers(users ?? []);
    setShowBlocked(true);
  }

  async function unblockUser(userId: string) {
    if (!profile) return;
    Alert.alert('Unblock User', 'They will be able to see your profile and contact you again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          await supabase
            .from('blocks')
            .delete()
            .eq('blocker_id', profile.id)
            .eq('blocked_id', userId);
          setBlockedUsers((prev) => prev.filter((u) => u.id !== userId));
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center px-4 py-4">
        <Pressable onPress={() => router.back()}>
          <Text className="text-white text-2xl">‹</Text>
        </Pressable>
        <Text className="text-white font-bold text-xl ml-4">Privacy</Text>
      </View>

      <ScrollView>
        <View className="mt-4 bg-snap-surface rounded-xl mx-4">
          <View className="px-4 py-4 border-b border-white/5">
            <Text className="text-white font-semibold mb-1">Who can contact me</Text>
            <Text className="text-snap-gray text-sm">Friends only</Text>
          </View>
          <View className="px-4 py-4 border-b border-white/5">
            <Text className="text-white font-semibold mb-1">Who can view my story</Text>
            <Text className="text-snap-gray text-sm">Friends only</Text>
          </View>
          <Pressable onPress={loadBlockedUsers} className="px-4 py-4">
            <Text className="text-white font-semibold">Blocked Users</Text>
            <Text className="text-snap-gray text-sm">Manage blocked accounts</Text>
          </Pressable>
        </View>

        {showBlocked && (
          <View className="mt-4 mx-4">
            <Text className="text-snap-gray text-sm font-semibold mb-2 uppercase tracking-wider">
              Blocked ({blockedUsers.length})
            </Text>
            {blockedUsers.length === 0 ? (
              <Text className="text-white/40 text-sm">No blocked users</Text>
            ) : (
              blockedUsers.map((user) => (
                <View key={user.id} className="flex-row items-center py-3 border-b border-white/5">
                  <View className="w-10 h-10 rounded-full bg-snap-surface items-center justify-center mr-3">
                    <Text className="text-white font-bold">
                      {user.display_name[0].toUpperCase()}
                    </Text>
                  </View>
                  <Text className="flex-1 text-white">{user.display_name}</Text>
                  <Pressable
                    onPress={() => unblockUser(user.id)}
                    className="bg-white/10 rounded-full px-3 py-1">
                    <Text className="text-white text-sm">Unblock</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
