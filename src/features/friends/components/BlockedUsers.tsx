import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '@lib/supabase/client';
import { Avatar } from '@components/ui/Avatar';
import { useAuthStore } from '@features/auth/store/authStore';
import { useThemeColors } from '@lib/theme/useThemeColors';
import type { DbUser } from '@/types/database';

interface BlockedEntry extends DbUser {
  blockId: string;
}

export function BlockedUsers() {
  const c = useThemeColors();
  const { t } = useTranslation();
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
    Alert.alert(t('search.blocked.unblockTitle', { name }), t('search.blocked.unblockBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('search.blocked.unblock'),
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
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  if (blocked.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-center" style={{ color: c.textMuted }}>
          {t('search.blocked.emptyMessage')}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={blocked}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View
          className="flex-row items-center px-4 py-3 border-b"
          style={{ borderColor: c.divider }}>
          <Avatar uri={item.avatar_url} name={item.display_name} size={44} />
          <View className="flex-1 ml-3">
            <Text className="font-semibold" style={{ color: c.textPrimary }}>
              {item.display_name}
            </Text>
            <Text className="text-sm" style={{ color: c.textSecondary }}>
              @{item.username}
            </Text>
          </View>
          <Pressable
            onPress={() => unblock(item.blockId, item.display_name)}
            className="rounded-full px-3 py-2"
            style={{ backgroundColor: c.surfaceElevated }}>
            <Text className="text-xs font-semibold" style={{ color: c.textPrimary }}>
              {t('search.blocked.unblock')}
            </Text>
          </Pressable>
        </View>
      )}
    />
  );
}
