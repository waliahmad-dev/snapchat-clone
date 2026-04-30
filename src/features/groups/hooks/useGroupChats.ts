import { useEffect, useId, useMemo, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { supabase } from '@lib/supabase/client';
import { database } from '@lib/watermelondb/database';
import GroupChat from '@lib/watermelondb/models/GroupChat';
import GroupMember from '@lib/watermelondb/models/GroupMember';
import GroupMessage from '@lib/watermelondb/models/GroupMessage';
import GroupMessageView from '@lib/watermelondb/models/GroupMessageView';
import Friend from '@lib/watermelondb/models/Friend';
import Outbox from '@lib/watermelondb/models/Outbox';
import { JOB } from '@lib/offline/jobs';
import { useAuthStore } from '@features/auth/store/authStore';
import type { DbUser } from '@/types/database';

export interface GroupChatSummary {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  members: DbUser[];
  lastMessageText: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  hasUnviewedMedia: boolean;
}

interface RemoteGroupRow {
  id: string;
  name: string | null;
  avatar_url: string | null;
  created_by: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RemoteMemberRow {
  id: string;
  group_id: string;
  user_id: string;
  notifications: 'all' | 'mentions' | 'none';
  joined_at: string;
  left_at: string | null;
}

export function useGroupChats() {
  const profile = useAuthStore((s) => s.profile);
  const instanceId = useId();
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [views, setViews] = useState<GroupMessageView[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const subs = [
      database
        .get<GroupChat>('group_chats')
        .query()
        .observeWithColumns(['name', 'avatar_url', 'last_message_text', 'last_message_at'])
        .subscribe(setGroups),
      database
        .get<GroupMember>('group_members')
        .query()
        .observeWithColumns(['notifications', 'left_at'])
        .subscribe((rows) => setMembers(rows.filter((r) => r.leftAt == null))),
      database
        .get<GroupMessage>('group_messages')
        .query(Q.where('deleted_at', null))
        .observe()
        .subscribe(setMessages),
      database
        .get<GroupMessageView>('group_message_views')
        .query()
        .observe()
        .subscribe(setViews),
      database
        .get<Friend>('friends')
        .query()
        .observe()
        .subscribe(setFriends),
    ];
    return () => subs.forEach((s) => s.unsubscribe());
  }, []);

  useEffect(() => {
    if (!profile) return;
    syncFromServer().finally(() => setLoading(false));

    const groupChannel = supabase
      .channel(`groups:${profile.id}:${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_chats' }, () =>
        syncFromServer()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () =>
        syncFromServer()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_messages' }, () =>
        syncFromServer()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(groupChannel);
    };
  }, [profile?.id, instanceId]);

  async function syncFromServer() {
    if (!profile) return;
    try {
      // Outbox jobs that haven't run yet protect their optimistic local rows
      // from being destroyed during sync (race: sync can fire before
      // GROUP_CREATE / GROUP_MEMBER_ADD has reached the server).
      const pendingOutbox = await database
        .get<Outbox>('outbox')
        .query(
          Q.or(
            Q.where('kind', JOB.GROUP_CREATE),
            Q.where('kind', JOB.GROUP_MEMBER_ADD)
          )
        )
        .fetch();
      const protectedGroupIds = new Set<string>();
      const protectedMembershipIds = new Set<string>();
      for (const job of pendingOutbox) {
        try {
          const payload = JSON.parse(job.payload) as
            | { groupId?: string; createdByMembershipId?: string; memberMembershipIds?: Record<string, string>; membershipId?: string };
          if (payload.groupId) protectedGroupIds.add(payload.groupId);
          if (payload.createdByMembershipId)
            protectedMembershipIds.add(payload.createdByMembershipId);
          if (payload.memberMembershipIds) {
            for (const mid of Object.values(payload.memberMembershipIds)) {
              protectedMembershipIds.add(mid);
            }
          }
          if (payload.membershipId) protectedMembershipIds.add(payload.membershipId);
        } catch {
          // ignore corrupt payload
        }
      }

      const { data: myMemberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', profile.id)
        .is('left_at', null);

      const groupIds = (myMemberships ?? []).map((m: { group_id: string }) => m.group_id);
      if (groupIds.length === 0) {
        // Don't drop anything if any GROUP_CREATE / GROUP_MEMBER_ADD jobs
        // are still pending — they may not have hit the server yet.
        if (protectedGroupIds.size > 0) return;
        const local = await database.get<GroupChat>('group_chats').query().fetch();
        const droppable = local.filter((g) => g.syncedAt != null);
        if (droppable.length > 0) {
          await database.write(async () => {
            for (const g of droppable) await g.destroyPermanently();
          });
        }
        return;
      }

      const [{ data: groupsData }, { data: membersData }] = await Promise.all([
        supabase.from('group_chats').select('*').in('id', groupIds),
        supabase.from('group_members').select('*').in('group_id', groupIds),
      ]);

      if (!groupsData) return;

      const collection = database.get<GroupChat>('group_chats');
      const existing = await collection.query().fetch();
      const byRemoteId = new Map(existing.map((g) => [g.remoteId, g]));
      const seen = new Set<string>();

      await database.write(async () => {
        for (const g of groupsData as RemoteGroupRow[]) {
          seen.add(g.id);
          const lastAt = g.last_message_at ? new Date(g.last_message_at).getTime() : null;
          const existingRow = byRemoteId.get(g.id);
          if (existingRow) {
            await existingRow.update((row) => {
              row.name = g.name;
              row.avatarUrl = g.avatar_url;
              row.createdBy = g.created_by ?? '';
              row.lastMessageText = g.last_message_text;
              row.lastMessageAt = lastAt;
              row.updatedAt = new Date(g.updated_at).getTime();
              row.syncedAt = Date.now();
            });
          } else {
            await collection.create((row) => {
              row.remoteId = g.id;
              row.name = g.name;
              row.avatarUrl = g.avatar_url;
              row.createdBy = g.created_by ?? '';
              row.lastMessageText = g.last_message_text;
              row.lastMessageAt = lastAt;
              row.createdAt = new Date(g.created_at).getTime();
              row.updatedAt = new Date(g.updated_at).getTime();
              row.syncedAt = Date.now();
              row.deletedAt = null;
            });
          }
        }

        for (const [remoteId, row] of byRemoteId) {
          if (seen.has(remoteId)) continue;
          if (protectedGroupIds.has(remoteId)) continue; // outbox still pending
          if (row.syncedAt == null) continue; // never confirmed by server yet
          await row.destroyPermanently();
        }
      });

      // Members
      if (membersData) {
        const memberCollection = database.get<GroupMember>('group_members');
        const localMembers = await memberCollection.query().fetch();
        const byKey = new Map(localMembers.map((m) => [m.remoteId, m]));
        const seenMembers = new Set<string>();

        await database.write(async () => {
          for (const m of membersData as RemoteMemberRow[]) {
            seenMembers.add(m.id);
            const existingRow = byKey.get(m.id);
            if (existingRow) {
              await existingRow.update((row) => {
                row.notifications = m.notifications;
                row.leftAt = m.left_at ? new Date(m.left_at).getTime() : null;
              });
            } else {
              await memberCollection.create((row) => {
                row.remoteId = m.id;
                row.groupId = m.group_id;
                row.userId = m.user_id;
                row.notifications = m.notifications;
                row.joinedAt = new Date(m.joined_at).getTime();
                row.leftAt = m.left_at ? new Date(m.left_at).getTime() : null;
              });
            }
          }

          for (const [remoteId, row] of byKey) {
            if (seenMembers.has(remoteId)) continue;
            if (protectedMembershipIds.has(remoteId)) continue; // outbox still pending
            if (protectedGroupIds.has(row.groupId)) continue; // group not yet created server-side
            await row.destroyPermanently();
          }
        });
      }
    } catch (err) {
      console.warn('[Groups] sync failed:', err);
    }
  }

  const enriched = useMemo<GroupChatSummary[]>(() => {
    if (!profile) return [];
    const friendsByUserId = new Map(friends.map((f) => [f.userId, f]));
    const myMembershipGroups = new Set(
      members.filter((m) => m.userId === profile.id && m.leftAt == null).map((m) => m.groupId)
    );
    const viewedByMe = new Set(
      views.filter((v) => v.userId === profile.id).map((v) => v.messageId)
    );

    const result: GroupChatSummary[] = [];
    for (const g of groups) {
      if (!myMembershipGroups.has(g.remoteId)) continue;
      const groupMembers = members
        .filter((m) => m.groupId === g.remoteId && m.userId !== profile.id)
        .map((m) => {
          const f = friendsByUserId.get(m.userId);
          if (f) {
            return {
              id: f.userId,
              username: f.username,
              display_name: f.displayName,
              avatar_url: f.avatarUrl,
              snap_score: f.snapScore,
              date_of_birth: null,
              phone: null,
              created_at: new Date(f.createdAt).toISOString(),
            } as DbUser;
          }
          return {
            id: m.userId,
            username: '',
            display_name: 'Member',
            avatar_url: null,
            snap_score: 0,
            date_of_birth: null,
            phone: null,
            created_at: new Date(m.joinedAt).toISOString(),
          } as DbUser;
        });

      const groupMessages = messages.filter((m) => m.groupId === g.remoteId);
      let unreadCount = 0;
      let hasUnviewedMedia = false;
      for (const m of groupMessages) {
        if (m.senderId === profile.id) continue;
        if (m.type === 'system') continue;
        if (viewedByMe.has(m.remoteId)) continue;
        unreadCount += 1;
        if (m.type === 'media') hasUnviewedMedia = true;
      }

      result.push({
        id: g.remoteId,
        name: g.name,
        avatarUrl: g.avatarUrl,
        members: groupMembers,
        lastMessageText: g.lastMessageText,
        lastMessageAt: g.lastMessageAt ? new Date(g.lastMessageAt).toISOString() : null,
        unreadCount,
        hasUnviewedMedia,
      });
    }

    result.sort((a, b) => {
      const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
      const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
      return tb - ta;
    });

    return result;
  }, [groups, members, messages, views, friends, profile]);

  const totalUnread = enriched.reduce((acc, g) => acc + g.unreadCount, 0);

  return { groups: enriched, loading, totalUnread, refresh: syncFromServer };
}
