import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '@lib/supabase/client';
import { Avatar } from '@components/ui/Avatar';
import { useAuthStore } from '@features/auth/store/authStore';
import type { DbUser } from '@/types/database';

interface BlockedEntry extends DbUser {
  blockId: string;
}

export function BlockedUsers() {
  const profile = useAuthStore((s) => s.profile);
  const [blocked, setBlocked] = useState<BlockedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [profile?.id]);

  async function load() {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: blocks } = await supabase
        .from('blocks')
        .select('id, blocked_id')
        .eq('blocker_id', profile.id);

      if (!blocks || blocks.length === 0) {
        setBlocked([]);
        return;
      }

      const ids = blocks.map((b: { blocked_id: string }) => b.blocked_id);
      const { data: users } = await supabase
        .from('users')
        .select('*')
        .in('id', ids);

      const blockMap = new Map(blocks.map((b: { id: string; blocked_id: string }) => [b.blocked_id, b.id]));
      setBlocked(
        (users ?? []).map((u: DbUser) => ({ ...u, blockId: blockMap.get(u.id)! }))
      );
    } finally {
      setLoading(false);
    }
  }

  async function unblock(blockId: string, name: string) {
    Alert.alert(`Unblock ${name}?`, 'They will be able to see your profile and send you snaps.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          await supabase.from('blocks').delete().eq('id', blockId);
          load();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#FFFC00" />
      </View>
    );
  }

  if (blocked.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-white/40 text-center">No blocked users</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={blocked}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View className="flex-row items-center px-4 py-3 border-b border-white/5">
          <Avatar uri={item.avatar_url} name={item.display_name} size={44} />
          <View className="flex-1 ml-3">
            <Text className="text-white font-semibold">{item.display_name}</Text>
            <Text className="text-snap-gray text-sm">@{item.username}</Text>
          </View>
          <Pressable
            onPress={() => unblock(item.blockId, item.display_name)}
            className="bg-white/10 rounded-full px-3 py-2">
            <Text className="text-white text-xs font-semibold">Unblock</Text>
          </Pressable>
        </View>
      )}
    />
  );
}
