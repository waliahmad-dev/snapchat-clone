import { useEffect, useId, useState } from 'react';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';
import type { DbConversation, DbUser } from '@/types/database';

export type ConversationStatus =
  | 'sent'         
  | 'opened'       
  | 'replied'       
  | 'received'    
  | 'empty';       

export interface ConversationWithPartner extends DbConversation {
  partner: DbUser;
  unread_count: number;
  unviewed_snap_ids: string[];
  status: ConversationStatus;
  lastActivityAt: string | null;
}

export function useConversations() {
  const profile = useAuthStore((s) => s.profile);
  const instanceId = useId();
  const [conversations, setConversations] = useState<ConversationWithPartner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    loadConversations();

    const convChannel = supabase
      .channel(`conversations:${profile.id}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => loadConversations(),
      )
      .subscribe();

    const msgChannel = supabase
      .channel(`messages-for-convs:${profile.id}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => loadConversations(),
      )
      .subscribe();

    // Pick up avatar/display-name edits live so conversation rows always show
    // the partner's current picture, not a stale one from the initial fetch.
    const userChannel = supabase
      .channel(`users-for-convs:${profile.id}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users' },
        () => loadConversations(),
      )
      .subscribe();

    // Friendship INSERT/DELETE decides whether a conversation row is visible
    // (we filter by accepted friendship), so we reload when one flips.
    const friendChannel = supabase
      .channel(`friendships-for-convs:${profile.id}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships' },
        () => loadConversations(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(convChannel);
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(userChannel);
      supabase.removeChannel(friendChannel);
    };
  }, [profile?.id, instanceId]);

  async function loadConversations() {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: convs } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_1.eq.${profile.id},participant_2.eq.${profile.id}`)
        .order('updated_at', { ascending: false });

      if (!convs || convs.length === 0) {
        setConversations([]);
        return;
      }

      const convIds = convs.map((c: DbConversation) => c.id);
      const partnerIds = convs.map((c: DbConversation) =>
        c.participant_1 === profile.id ? c.participant_2 : c.participant_1,
      );

      // Also fetch the accepted-friendship list so we can hide conversation
      // rows for unfriended/blocked users. The conversations table has no
      // deleted_at column and its row is reused on re-friend (unique pair
      // constraint), so friendship status is our source of truth for "is
      // this contact still in my chat list".
      const [{ data: partners }, { data: messages }, { data: friendRows }] =
        await Promise.all([
          supabase.from('users').select('*').in('id', partnerIds),
          supabase
            .from('messages')
            .select('id, conversation_id, sender_id, viewed_at, created_at, type, deleted_at')
            .in('conversation_id', convIds)
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
          supabase
            .from('friendships')
            .select('requester_id, addressee_id, status')
            .eq('status', 'accepted')
            .or(
              `requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`,
            ),
        ]);

      const acceptedPartnerIds = new Set<string>();
      for (const f of friendRows ?? []) {
        acceptedPartnerIds.add(
          f.requester_id === profile.id ? f.addressee_id : f.requester_id,
        );
      }

      const partnerMap = new Map((partners ?? []).map((u: DbUser) => [u.id, u]));

      type MsgSummary = {
        last?: { sender_id: string; viewed_at: string | null; created_at: string };
        hasMySent: boolean;
        unreadCount: number;         
        unviewedSnapIds: string[];   
      };
      const summary = new Map<string, MsgSummary>();
      for (const msg of messages ?? []) {
        const entry =
          summary.get(msg.conversation_id) ?? {
            hasMySent: false,
            unreadCount: 0,
            unviewedSnapIds: [],
          };
        if (!entry.last) {
          entry.last = {
            sender_id: msg.sender_id,
            viewed_at: msg.viewed_at,
            created_at: msg.created_at,
          };
        }
        if (msg.sender_id === profile.id) {
          entry.hasMySent = true;
        } else if (!msg.viewed_at && msg.type !== 'system') {
          entry.unreadCount += 1;
          if (msg.type === 'snap') {
            entry.unviewedSnapIds.unshift(msg.id);
          }
        }
        summary.set(msg.conversation_id, entry);
      }

      const enriched: ConversationWithPartner[] = convs
        .map((c: DbConversation) => {
          const partnerId =
            c.participant_1 === profile.id ? c.participant_2 : c.participant_1;
          const partner = partnerMap.get(partnerId);
          if (!partner) return null;
          // Skip conversations whose partner is no longer an accepted
          // friend — that row is a stale remnant from before unfriend/block.
          if (!acceptedPartnerIds.has(partnerId)) return null;

          const s = summary.get(c.id);
          const last = s?.last;
          const hasMySent = s?.hasMySent ?? false;

          let status: ConversationStatus = 'empty';
          if (last) {
            if (last.sender_id === profile.id) {
              status = last.viewed_at ? 'opened' : 'sent';
            } else {
              status = hasMySent ? 'replied' : 'received';
            }
          }

          return {
            ...c,
            partner,
            unread_count: s?.unreadCount ?? 0,
            unviewed_snap_ids: s?.unviewedSnapIds ?? [],
            status,
            lastActivityAt: last?.created_at ?? null,
          } as ConversationWithPartner;
        })
        .filter(Boolean) as ConversationWithPartner[];

      enriched.sort((a, b) => {
        const ta = a.lastActivityAt ? Date.parse(a.lastActivityAt) : Date.parse(a.updated_at);
        const tb = b.lastActivityAt ? Date.parse(b.lastActivityAt) : Date.parse(b.updated_at);
        return tb - ta;
      });

      setConversations(enriched);
    } finally {
      setLoading(false);
    }
  }

  const totalUnread = conversations.reduce(
    (acc, c) => acc + (c.unread_count ?? 0),
    0,
  );

  return { conversations, loading, totalUnread, refresh: loadConversations };
}
