import { useEffect, useId, useState } from 'react';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';
import type { DbUser, DbFriendship, FriendshipStatus } from '@/types/database';

export interface FriendWithStatus extends DbUser {
  friendshipId: string;
  status: FriendshipStatus;
  isRequester: boolean;
}

export function useFriends() {
  const profile = useAuthStore((s) => s.profile);
  const instanceId = useId();
  const [friends, setFriends] = useState<FriendWithStatus[]>([]);
  const [pendingReceived, setPendingReceived] = useState<FriendWithStatus[]>([]);
  const [pendingSent, setPendingSent] = useState<FriendWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    loadFriends();

    const channelName = `friendships:${profile.id}:${instanceId}`;
    const sub = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () =>
        loadFriends()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [profile?.id, instanceId]);

  async function loadFriends() {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('*')
        .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
        .neq('status', 'blocked');

      if (!friendships) return;

      const otherIds = friendships.map((f: DbFriendship) =>
        f.requester_id === profile.id ? f.addressee_id : f.requester_id
      );

      if (otherIds.length === 0) {
        setFriends([]);
        setPendingReceived([]);
        setPendingSent([]);
        return;
      }

      const { data: users } = await supabase.from('users').select('*').in('id', otherIds);

      const userMap = new Map((users ?? []).map((u: DbUser) => [u.id, u]));

      const enriched: FriendWithStatus[] = friendships
        .map((f: DbFriendship) => {
          const otherId = f.requester_id === profile.id ? f.addressee_id : f.requester_id;
          const user = userMap.get(otherId);
          if (!user) return null;
          return {
            ...user,
            friendshipId: f.id,
            status: f.status,
            isRequester: f.requester_id === profile.id,
          } as FriendWithStatus;
        })
        .filter(Boolean) as FriendWithStatus[];

      const byUser = new Map<string, FriendWithStatus>();
      for (const f of enriched) {
        const existing = byUser.get(f.id);
        if (!existing || (existing.status !== 'accepted' && f.status === 'accepted')) {
          byUser.set(f.id, f);
        }
      }
      const deduped = Array.from(byUser.values());

      setFriends(deduped.filter((f) => f.status === 'accepted'));
      setPendingReceived(deduped.filter((f) => f.status === 'pending' && !f.isRequester));
      setPendingSent(deduped.filter((f) => f.status === 'pending' && f.isRequester));
    } finally {
      setLoading(false);
    }
  }

  return { friends, pendingReceived, pendingSent, loading, refresh: loadFriends };
}
