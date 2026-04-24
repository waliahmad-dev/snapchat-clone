import { useEffect, useId, useState } from 'react';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';

export function useUnreadCount(): number {
  const profile = useAuthStore((s) => s.profile);
  const instanceId = useId();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    async function load() {
      const { count: c } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .neq('sender_id', profile!.id)
        .is('viewed_at', null)
        .is('deleted_at', null)
        .neq('type', 'system');
      if (!cancelled) setCount(c ?? 0);
    }

    load();

    const channel = supabase
      .channel(`unread-count:${profile.id}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
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
