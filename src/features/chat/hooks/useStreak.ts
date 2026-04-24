import { useEffect, useState } from 'react';
import { getStreak, getStreakTTL } from '@lib/redis/streak';
import { STREAK_TTL_SECONDS } from '@constants/config';

interface StreakInfo {
  count: number;
  ttlSeconds: number;
  isWarning: boolean;
}

export function useStreak(userId1: string, userId2: string) {
  const [streak, setStreak] = useState<StreakInfo | null>(null);

  useEffect(() => {
    if (!userId1 || !userId2) return;
    load();
  }, [userId1, userId2]);

  async function load() {
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
  }

  return streak;
}
