import { useEffect, useId, useMemo, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { supabase } from '@lib/supabase/client';
import { database } from '@lib/watermelondb/database';
import Conversation from '@lib/watermelondb/models/Conversation';
import Message from '@lib/watermelondb/models/Message';
import Friend from '@lib/watermelondb/models/Friend';
import { useAuthStore } from '@features/auth/store/authStore';
import { upsertRemoteMessage, type RemoteMessageRow } from '../utils/messageSync';
import type { DbConversation, DbUser } from '@/types/database';

export type ConversationStatus = 'sent' | 'opened' | 'replied' | 'received' | 'empty';

export interface ConversationWithPartner extends DbConversation {
  partner: DbUser;
  unread_count: number;
  unviewed_snap_ids: string[];
  status: ConversationStatus;
  lastActivityAt: string | null;
}

interface RemoteFriendship {
  requester_id: string;
  addressee_id: string;
  status: string;
}

export function useConversations() {
  const profile = useAuthStore((s) => s.profile);
  const instanceId = useId();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const subs = [
      database
        .get<Conversation>('conversations')
        .query()
        .observe()
        .subscribe((rows) => setConversations(rows)),
      database
        .get<Message>('messages')
        .query(Q.where('deleted_at', null), Q.where('hidden_locally', Q.notEq(true)))
        // observeWithColumns so unread_count recomputes when viewed_at flips,
        // not only when a row is inserted or deleted.
        .observeWithColumns(['viewed_at', 'saved'])
        .subscribe((rows) => setMessages(rows)),
      database
        .get<Friend>('friends')
        .query(Q.where('status', 'accepted'))
        .observe()
        .subscribe((rows) => setFriends(rows)),
    ];
    return () => subs.forEach((s) => s.unsubscribe());
  }, []);

  useEffect(() => {
    if (!profile) return;
    syncFromServer().finally(() => setLoading(false));

    const convChannel = supabase
      .channel(`conversations:${profile.id}:${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () =>
        syncFromServer(),
      )
      .subscribe();

    const msgChannel = supabase
      .channel(`messages-for-convs:${profile.id}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as RemoteMessageRow;
          database
            .write(async () => {
              await upsertRemoteMessage(row);
            })
            .catch((err) =>
              console.warn('[Conversations] realtime INSERT failed:', err),
            );
          void syncFromServer();
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as RemoteMessageRow;
          database
            .write(async () => {
              await upsertRemoteMessage(row);
            })
            .catch((err) =>
              console.warn('[Conversations] realtime UPDATE failed:', err),
            );
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        () => syncFromServer(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(convChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [profile?.id, instanceId]);

  async function syncFromServer() {
    if (!profile) return;
    try {
      const { data: convs } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_1.eq.${profile.id},participant_2.eq.${profile.id}`)
        .order('updated_at', { ascending: false });

      if (!convs) return;

      const collection = database.get<Conversation>('conversations');
      const existing = await collection.query().fetch();
      const byRemoteId = new Map(existing.map((c) => [c.remoteId, c]));
      const seen = new Set<string>();

      // Pull last message text per conversation in one batch
      const convIds = (convs as DbConversation[]).map((c) => c.id);
      let lastMessageByConv = new Map<string, { content: string | null; created_at: string; type: string }>();
      if (convIds.length > 0) {
        const { data: lastMessages } = await supabase
          .from('messages')
          .select('conversation_id, content, created_at, type')
          .in('conversation_id', convIds)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });
        if (lastMessages) {
          type LastMessageRow = {
            conversation_id: string;
            content: string | null;
            created_at: string;
            type: string;
          };
          for (const m of lastMessages as LastMessageRow[]) {
            if (!lastMessageByConv.has(m.conversation_id)) {
              lastMessageByConv.set(m.conversation_id, m);
            }
          }
        }
      }

      await database.write(async () => {
        for (const c of convs as DbConversation[]) {
          seen.add(c.id);
          const last = lastMessageByConv.get(c.id);
          const lastText =
            last?.type === 'snap' ? '📸 Snap' : last?.content ?? null;
          const lastAt = last ? new Date(last.created_at).getTime() : null;

          const existingRow = byRemoteId.get(c.id);
          if (existingRow) {
            await existingRow.update((row) => {
              row.participant1Id = c.participant_1;
              row.participant2Id = c.participant_2;
              row.streakCount = c.streak_count;
              row.updatedAt = new Date(c.updated_at).getTime();
              row.lastMessageText = lastText;
              row.lastMessageAt = lastAt;
              row.syncedAt = Date.now();
            });
          } else {
            await collection.create((row) => {
              row.remoteId = c.id;
              row.participant1Id = c.participant_1;
              row.participant2Id = c.participant_2;
              row.streakCount = c.streak_count;
              row.unreadCount = 0;
              row.lastMessageText = lastText;
              row.lastMessageAt = lastAt;
              row.updatedAt = new Date(c.updated_at).getTime();
              row.syncedAt = Date.now();
            });
          }
        }

        for (const [remoteId, row] of byRemoteId) {
          if (!seen.has(remoteId)) {
            await row.destroyPermanently();
          }
        }
      });

      // Friendship reconcile (same as old hook for the partner/blocked logic)
      const { data: friendRows } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id, status')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`);
      void (friendRows as RemoteFriendship[] | null);
    } catch (err) {
      console.warn('[Conversations] sync failed:', err);
    }
  }

  const enriched = useMemo<ConversationWithPartner[]>(() => {
    if (!profile) return [];
    const friendsByUserId = new Map(friends.map((f) => [f.userId, f]));
    const messagesByConv = new Map<string, Message[]>();
    for (const m of messages) {
      const list = messagesByConv.get(m.conversationId) ?? [];
      list.push(m);
      messagesByConv.set(m.conversationId, list);
    }

    const result: ConversationWithPartner[] = [];
    for (const conv of conversations) {
      const partnerId =
        conv.participant1Id === profile.id ? conv.participant2Id : conv.participant1Id;
      const friend = friendsByUserId.get(partnerId);
      if (!friend) continue;

      const convMessages = (messagesByConv.get(conv.remoteId) ?? [])
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt);
      const last = convMessages[0];
      const hasMySent = convMessages.some((m) => m.senderId === profile.id);

      let unreadCount = 0;
      const unviewedSnapIds: string[] = [];
      for (const m of convMessages) {
        if (m.senderId === profile.id) continue;
        if (m.type === 'system') continue;
        if (m.viewedAt) continue;
        unreadCount += 1;
        if (m.type === 'snap' && m.remoteId) unviewedSnapIds.unshift(m.remoteId);
      }

      let status: ConversationStatus = 'empty';
      if (last) {
        if (last.senderId === profile.id) {
          status = last.viewedAt ? 'opened' : 'sent';
        } else {
          status = hasMySent ? 'replied' : 'received';
        }
      }

      const partner: DbUser = {
        id: friend.userId,
        username: friend.username,
        display_name: friend.displayName,
        avatar_url: friend.avatarUrl,
        snap_score: friend.snapScore,
        date_of_birth: null,
        phone: null,
        created_at: new Date(friend.createdAt).toISOString(),
      };

      result.push({
        id: conv.remoteId,
        participant_1: conv.participant1Id,
        participant_2: conv.participant2Id,
        last_message_id: null,
        streak_count: conv.streakCount,
        updated_at: new Date(conv.updatedAt).toISOString(),
        partner,
        unread_count: unreadCount,
        unviewed_snap_ids: unviewedSnapIds,
        status,
        lastActivityAt: last ? new Date(last.createdAt).toISOString() : null,
      });
    }

    result.sort((a, b) => {
      const ta = a.lastActivityAt ? Date.parse(a.lastActivityAt) : Date.parse(a.updated_at);
      const tb = b.lastActivityAt ? Date.parse(b.lastActivityAt) : Date.parse(b.updated_at);
      return tb - ta;
    });

    return result;
  }, [conversations, messages, friends, profile]);

  const totalUnread = enriched.reduce((acc, c) => acc + (c.unread_count ?? 0), 0);

  return {
    conversations: enriched,
    loading,
    totalUnread,
    refresh: syncFromServer,
  };
}
