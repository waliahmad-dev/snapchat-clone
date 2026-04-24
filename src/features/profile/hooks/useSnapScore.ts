import { useEffect, useState } from 'react';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';

export function useSnapScore(userId?: string) {
  const currentUser = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const targetId = userId ?? currentUser?.id;
  const [score, setScore] = useState(
    !userId ? (currentUser?.snap_score ?? 0) : 0
  );

  useEffect(() => {
    if (!targetId) return;

    const sub = supabase
      .channel(`snap_score:${targetId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${targetId}`,
        },
        (payload) => {
          const updated = payload.new as { snap_score: number };
          setScore(updated.snap_score);
          if (!userId && currentUser) {
            setProfile({ ...currentUser, snap_score: updated.snap_score });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [targetId]);

  return score;
}
