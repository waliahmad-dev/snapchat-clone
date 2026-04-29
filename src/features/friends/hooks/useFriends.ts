import { useEffect, useId, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { supabase } from '@lib/supabase/client';
import { database } from '@lib/watermelondb/database';
import Friend from '@lib/watermelondb/models/Friend';
import { useAuthStore } from '@features/auth/store/authStore';
import type { DbUser, DbFriendship, FriendshipStatus } from '@/types/database';

export interface FriendWithStatus extends DbUser {
  friendshipId: string;
  status: FriendshipStatus;
  isRequester: boolean;
}

function toFriendWithStatus(f: Friend): FriendWithStatus {
  return {
    id: f.userId,
    username: f.username,
    display_name: f.displayName,
    avatar_url: f.avatarUrl,
    snap_score: f.snapScore,
    date_of_birth: null,
    phone: null,
    created_at: new Date(f.createdAt).toISOString(),
    friendshipId: f.remoteId,
    status: f.status,
    isRequester: f.isRequester,
  };
}

export function useFriends() {
  const profile = useAuthStore((s) => s.profile);
  const instanceId = useId();
  const [friends, setFriends] = useState<FriendWithStatus[]>([]);
  const [pendingReceived, setPendingReceived] = useState<FriendWithStatus[]>([]);
  const [pendingSent, setPendingSent] = useState<FriendWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sub = database
      .get<Friend>('friends')
      .query(Q.where('status', Q.notEq('blocked')))
      .observe()
      .subscribe((rows) => {
        const all = rows.map(toFriendWithStatus);
        setFriends(all.filter((f) => f.status === 'accepted'));
        setPendingReceived(
          all.filter((f) => f.status === 'pending' && !f.isRequester),
        );
        setPendingSent(all.filter((f) => f.status === 'pending' && f.isRequester));
        setLoading(false);
      });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    if (!profile) return;
    syncFromServer();

    const sub = supabase
      .channel(`friendships:${profile.id}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships' },
        () => syncFromServer(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [profile?.id, instanceId]);

  async function syncFromServer() {
    if (!profile) return;
    try {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('*')
        .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
        .neq('status', 'blocked');

      if (!friendships) return;

      const otherIds = friendships.map((f: DbFriendship) =>
        f.requester_id === profile.id ? f.addressee_id : f.requester_id,
      );

      const userMap = new Map<string, DbUser>();
      if (otherIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('*')
          .in('id', otherIds);
        for (const u of (users ?? []) as DbUser[]) userMap.set(u.id, u);
      }

      const collection = database.get<Friend>('friends');
      const existing = await collection.query().fetch();
      const byUser = new Map<string, Friend>();
      for (const e of existing) byUser.set(e.userId, e);

      const seenUserIds = new Set<string>();

      await database.write(async () => {
        for (const f of friendships as DbFriendship[]) {
          const otherId =
            f.requester_id === profile.id ? f.addressee_id : f.requester_id;
          const user = userMap.get(otherId);
          if (!user) continue;
          seenUserIds.add(otherId);

          const existingRow = byUser.get(otherId);
          if (existingRow) {
            await existingRow.update((row) => {
              row.remoteId = f.id;
              row.username = user.username;
              row.displayName = user.display_name;
              row.avatarUrl = user.avatar_url;
              row.status = f.status;
              row.isRequester = f.requester_id === profile.id;
              row.snapScore = user.snap_score;
              row.syncedAt = Date.now();
            });
          } else {
            await collection.create((row) => {
              row.remoteId = f.id;
              row.userId = otherId;
              row.username = user.username;
              row.displayName = user.display_name;
              row.avatarUrl = user.avatar_url;
              row.status = f.status;
              row.isRequester = f.requester_id === profile.id;
              row.snapScore = user.snap_score;
              row.createdAt = new Date(f.created_at).getTime();
              row.syncedAt = Date.now();
            });
          }
        }

        for (const [userId, row] of byUser) {
          if (!seenUserIds.has(userId)) {
            await row.destroyPermanently();
          }
        }
      });
    } catch (err) {
      console.warn('[Friends] sync failed:', err);
    }
  }

  return { friends, pendingReceived, pendingSent, loading, refresh: syncFromServer };
}
