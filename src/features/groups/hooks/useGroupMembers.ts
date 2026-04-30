import { useEffect, useMemo, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { supabase } from '@lib/supabase/client';
import { database } from '@lib/watermelondb/database';
import GroupMember from '@lib/watermelondb/models/GroupMember';
import Friend from '@lib/watermelondb/models/Friend';
import { useAuthStore } from '@features/auth/store/authStore';
import type { DbUser, GroupNotificationsSetting } from '@/types/database';

export interface GroupMemberWithUser {
  membershipId: string;
  user: DbUser;
  joinedAt: string;
  notifications: GroupNotificationsSetting;
  isMe: boolean;
  isCreator: boolean;
}

export function useGroupMembers(groupId: string, createdById?: string) {
  const profile = useAuthStore((s) => s.profile);
  const [memberRows, setMemberRows] = useState<GroupMember[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [unknownUsers, setUnknownUsers] = useState<Map<string, DbUser>>(new Map());

  useEffect(() => {
    if (!groupId) return;
    const sub1 = database
      .get<GroupMember>('group_members')
      .query(Q.where('group_id', groupId))
      .observeWithColumns(['notifications', 'left_at'])
      .subscribe((rows) => setMemberRows(rows.filter((r) => r.leftAt == null)));
    const sub2 = database.get<Friend>('friends').query().observe().subscribe(setFriends);
    return () => {
      sub1.unsubscribe();
      sub2.unsubscribe();
    };
  }, [groupId]);

  // Resolve any members that aren't friends (e.g., my own profile, third-party users) via Supabase users.
  useEffect(() => {
    if (!profile) return;
    const friendIds = new Set(friends.map((f) => f.userId));
    const missing = memberRows
      .map((m) => m.userId)
      .filter((id) => id !== profile.id && !friendIds.has(id) && !unknownUsers.has(id));
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from('users').select('*').in('id', missing);
        if (cancelled || !data) return;
        setUnknownUsers((prev) => {
          const next = new Map(prev);
          for (const u of data as DbUser[]) next.set(u.id, u);
          return next;
        });
      } catch {
        // offline; will retry next observe tick
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [memberRows, friends, profile, unknownUsers]);

  const members = useMemo<GroupMemberWithUser[]>(() => {
    if (!profile) return [];
    const friendsByUserId = new Map(friends.map((f) => [f.userId, f]));

    return memberRows.map((m) => {
      let user: DbUser;
      if (m.userId === profile.id) {
        user = {
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          snap_score: profile.snap_score,
          date_of_birth: null,
          phone: null,
          created_at: profile.created_at,
        };
      } else {
        const f = friendsByUserId.get(m.userId);
        if (f) {
          user = {
            id: f.userId,
            username: f.username,
            display_name: f.displayName,
            avatar_url: f.avatarUrl,
            snap_score: f.snapScore,
            date_of_birth: null,
            phone: null,
            created_at: new Date(f.createdAt).toISOString(),
          };
        } else {
          const fetched = unknownUsers.get(m.userId);
          user = fetched ?? {
            id: m.userId,
            username: '',
            display_name: 'Member',
            avatar_url: null,
            snap_score: 0,
            date_of_birth: null,
            phone: null,
            created_at: new Date(m.joinedAt).toISOString(),
          };
        }
      }
      return {
        membershipId: m.remoteId,
        user,
        joinedAt: new Date(m.joinedAt).toISOString(),
        notifications: m.notifications,
        isMe: m.userId === profile.id,
        isCreator: createdById === m.userId,
      };
    });
  }, [memberRows, friends, profile, createdById, unknownUsers]);

  const myMembership = members.find((m) => m.isMe);

  return { members, myMembership };
}
