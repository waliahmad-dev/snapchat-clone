import { useEffect, useId, useState } from 'react';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';

export function useFriendRequestCount(): number {
  const profile = useAuthStore((s) => s.profile);
  const instanceId = useId();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    async function load() {
      try {
        const { count: c } = await supabase
          .from('friendships')
          .select('id', { count: 'exact', head: true })
          .eq('addressee_id', profile!.id)
          .eq('status', 'pending');
        if (!cancelled) setCount(c ?? 0);
      } catch {
        // offline — keep last value
      }
    }

    load();

    const channel = supabase
      .channel(`friend-request-count:${profile.id}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships' },
        () => {
          load();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [profile?.id, instanceId]);

  return count;
}
