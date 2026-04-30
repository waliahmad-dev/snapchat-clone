import { Q } from '@nozbe/watermelondb';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';
import { database } from '@lib/watermelondb/database';
import Friend from '@lib/watermelondb/models/Friend';
import { enqueueJob } from '@lib/offline/outboxRunner';
import { JOB } from '@lib/offline/jobs';
import { uuid } from '@lib/offline/uuid';
import type { DbUser } from '@/types/database';

async function fetchUserSnapshot(userId: string): Promise<DbUser | null> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return (data as DbUser) ?? null;
}

async function upsertLocalFriend(args: {
  remoteId: string;
  userId: string;
  status: 'pending' | 'accepted' | 'blocked' | 'declined';
  isRequester: boolean;
  fallbackName?: string;
}): Promise<void> {
  const collection = database.get<Friend>('friends');
  const existing = await collection
    .query(Q.where('user_id', args.userId))
    .fetch();
  const snapshot = await fetchUserSnapshot(args.userId).catch(() => null);

  await database.write(async () => {
    if (existing.length > 0) {
      const target = existing[0];
      await target.update((f) => {
        f.remoteId = args.remoteId;
        f.status = args.status;
        f.isRequester = args.isRequester;
        if (snapshot) {
          f.username = snapshot.username;
          f.displayName = snapshot.display_name;
          f.avatarUrl = snapshot.avatar_url;
          f.snapScore = snapshot.snap_score;
        }
        f.syncedAt = Date.now();
      });
      return;
    }
    await collection.create((f) => {
      f.remoteId = args.remoteId;
      f.userId = args.userId;
      f.username = snapshot?.username ?? args.fallbackName ?? '';
      f.displayName = snapshot?.display_name ?? args.fallbackName ?? '';
      f.avatarUrl = snapshot?.avatar_url ?? null;
      f.status = args.status;
      f.isRequester = args.isRequester;
      f.snapScore = snapshot?.snap_score ?? 0;
      f.createdAt = Date.now();
      f.syncedAt = snapshot ? Date.now() : null;
    });
  });
}

async function deleteLocalFriendByRemoteId(friendshipId: string): Promise<void> {
  const matches = await database
    .get<Friend>('friends')
    .query(Q.where('remote_id', friendshipId))
    .fetch();
  if (matches.length === 0) return;
  await database.write(async () => {
    for (const m of matches) {
      await m.destroyPermanently();
    }
  });
}

async function deleteLocalFriendByUserId(userId: string): Promise<void> {
  const matches = await database
    .get<Friend>('friends')
    .query(Q.where('user_id', userId))
    .fetch();
  if (matches.length === 0) return;
  await database.write(async () => {
    for (const m of matches) {
      await m.destroyPermanently();
    }
  });
}

export function useFriendRequest() {
  const profile = useAuthStore((s) => s.profile);

  async function sendRequest(addresseeId: string): Promise<void> {
    if (!profile) return;
    const friendshipId = uuid();

    await upsertLocalFriend({
      remoteId: friendshipId,
      userId: addresseeId,
      status: 'pending',
      isRequester: true,
    });

    await enqueueJob({
      kind: JOB.FRIEND_REQUEST,
      payload: {
        requesterId: profile.id,
        addresseeId,
        friendshipId,
      },
      groupKey: `friend:${addresseeId}`,
    });
  }

  async function acceptRequest(friendshipId: string): Promise<void> {
    if (!profile) return;

    const matches = await database
      .get<Friend>('friends')
      .query(Q.where('remote_id', friendshipId))
      .fetch();
    const otherId = matches[0]?.userId;

    if (matches.length > 0) {
      await database.write(async () => {
        await matches[0].update((f) => {
          f.status = 'accepted';
        });
      });
    }

    if (!otherId) return;

    await enqueueJob({
      kind: JOB.FRIEND_ACCEPT,
      payload: {
        friendshipId,
        myId: profile.id,
        otherId,
      },
      groupKey: `friend:${otherId}`,
    });
  }

  async function declineRequest(friendshipId: string): Promise<void> {
    await deleteLocalFriendByRemoteId(friendshipId);
    await enqueueJob({
      kind: JOB.FRIEND_DECLINE,
      payload: { friendshipId },
      groupKey: `friend-decline:${friendshipId}`,
    });
  }

  async function removeFriend(friendshipId: string): Promise<void> {
    await deleteLocalFriendByRemoteId(friendshipId);
    await enqueueJob({
      kind: JOB.FRIEND_DECLINE,
      payload: { friendshipId },
      groupKey: `friend-remove:${friendshipId}`,
    });
  }

  async function unfriendAndPurge(friendshipId: string, otherUserId: string): Promise<void> {
    if (!profile) return;
    await deleteLocalFriendByUserId(otherUserId);
    await enqueueJob({
      kind: JOB.FRIEND_REMOVE,
      payload: {
        myId: profile.id,
        otherUserId,
        friendshipId,
      },
      groupKey: `friend:${otherUserId}`,
    });
  }

  async function blockUser(_friendshipId: string | null, blockedId: string): Promise<void> {
    if (!profile) return;
    void _friendshipId;
    await deleteLocalFriendByUserId(blockedId);
    await enqueueJob({
      kind: JOB.FRIEND_BLOCK,
      payload: {
        myId: profile.id,
        blockedId,
      },
      groupKey: `friend:${blockedId}`,
    });
  }

  async function getFriendshipStatus(otherUserId: string): Promise<{
    status: string | null;
    friendshipId: string | null;
    iSentRequest: boolean;
  }> {
    if (!profile) return { status: null, friendshipId: null, iSentRequest: false };

    const local = await database
      .get<Friend>('friends')
      .query(Q.where('user_id', otherUserId))
      .fetch();
    if (local.length > 0) {
      const f = local[0];
      return {
        status: f.status,
        friendshipId: f.remoteId,
        iSentRequest: f.isRequester,
      };
    }

    const { data: outgoing } = await supabase
      .from('friendships')
      .select('id, status')
      .eq('requester_id', profile.id)
      .eq('addressee_id', otherUserId)
      .maybeSingle();
    if (outgoing) {
      return { status: outgoing.status, friendshipId: outgoing.id, iSentRequest: true };
    }

    const { data: incoming } = await supabase
      .from('friendships')
      .select('id, status')
      .eq('requester_id', otherUserId)
      .eq('addressee_id', profile.id)
      .maybeSingle();
    if (incoming) {
      return { status: incoming.status, friendshipId: incoming.id, iSentRequest: false };
    }

    return { status: null, friendshipId: null, iSentRequest: false };
  }

  return {
    sendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
    unfriendAndPurge,
    blockUser,
    getFriendshipStatus,
  };
}
