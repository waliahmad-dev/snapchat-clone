import { useEffect, useId, useState } from 'react';
import { supabase } from '@lib/supabase/client';
import { getStreak, getStreakTTL } from '@lib/redis/streak';

interface StreakInfo {
  count: number;
  ttlSeconds: number;
  isWarning: boolean;
}

export function useStreak(userId1: string, userId2: string) {
  const instanceId = useId();
  const [streak, setStreak] = useState<StreakInfo | null>(null);

  useEffect(() => {
    if (!userId1 || !userId2) return;
    load();

    const sub = supabase
      .channel(`streak:${userId1}:${userId2}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as { type?: string; sender_id?: string };
          if (row.type !== 'snap') return;
          if (row.sender_id !== userId1 && row.sender_id !== userId2) return;
          load();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId1, userId2, instanceId]);

  async function load() {
    try {
      const [data, ttl] = await Promise.all([
        getStreak(userId1, userId2),
        getStreakTTL(userId1, userId2),
      ]);

      if (!data || ttl <= 0) {
        setStreak(null);
        return;
      }

      setStreak({
        count: data.count,
        ttlSeconds: ttl,
        isWarning: ttl < 6 * 3600,
      });
    } catch {
      // offline — keep last known streak; outbox banner indicates state
    }
  }

  return streak;
}
