import React, { useEffect, useId, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { supabase } from '@lib/supabase/client';
import { getStreak } from '@lib/redis/streak';
import { useFriends } from '@features/friends/hooks/useFriends';
import { useAuthStore } from '@features/auth/store/authStore';
import { streakEmoji } from '@features/chat/utils/streakHelpers';

interface StreakEntry {
  friendId: string;
  friendName: string;
  count: number;
}

export function StreakSummary() {
  const profile = useAuthStore((s) => s.profile);
  const { friends } = useFriends();
  const instanceId = useId();
  const [streaks, setStreaks] = useState<StreakEntry[]>([]);

  useEffect(() => {
    if (!profile || friends.length === 0) return;
    loadStreaks();

    const friendIds = new Set(friends.map((f) => f.id));
    const sub = supabase
      .channel(`streak-summary:${profile.id}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as { type?: string; sender_id?: string };
          if (row.type !== 'snap') return;
          if (row.sender_id !== profile.id && !friendIds.has(row.sender_id ?? '')) return;
          loadStreaks();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, friends, instanceId]);

  async function loadStreaks() {
    if (!profile) return;
    const entries: StreakEntry[] = [];
    for (const friend of friends) {
      const data = await getStreak(profile.id, friend.id);
      if (data && data.count > 0) {
        entries.push({ friendId: friend.id, friendName: friend.display_name, count: data.count });
      }
    }
    entries.sort((a, b) => b.count - a.count);
    setStreaks(entries);
  }

  if (streaks.length === 0) return null;

  return (
    <View className="mt-4 px-4">
      <Text className="text-snap-gray text-xs font-semibold uppercase tracking-wide mb-2">
        Active Streaks
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-3">
        {streaks.map((s) => (
          <View
            key={s.friendId}
            className="items-center bg-snap-surface rounded-xl px-4 py-3 mr-2 min-w-20">
            <Text className="text-2xl">{streakEmoji(s.count)}</Text>
            <Text className="text-white font-bold text-base">{s.count}</Text>
            <Text className="text-snap-gray text-xs" numberOfLines={1}>
              {s.friendName.split(' ')[0]}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
