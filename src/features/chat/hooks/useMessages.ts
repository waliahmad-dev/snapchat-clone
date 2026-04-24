import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';
import type { DbMessage } from '@/types/database';
import { MESSAGE_PAGE_SIZE } from '@constants/config';

export function useMessages(conversationId: string) {
  const profile = useAuthStore((s) => s.profile);
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId || !profile) return;
    loadMessages();

    const sub = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as DbMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [newMsg, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as DbMessage;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [conversationId, profile?.id]);

  async function loadMessages() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_PAGE_SIZE);

      setMessages(data ?? []);
    } finally {
      setLoading(false);
    }
  }

  const sendTextMessage = useCallback(
    async (
      content: string,
      replyToMessageId?: string | null,
    ): Promise<void> => {
      if (!profile || !content.trim()) return;

      const payload: Record<string, unknown> = {
        conversation_id: conversationId,
        sender_id: profile.id,
        content: content.trim(),
        type: 'text',
      };
      if (replyToMessageId) {
        payload.reply_to_message_id = replyToMessageId;
      }

      const { error } = await supabase.from('messages').insert(payload);
      if (error) throw error;

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    },
    [profile, conversationId],
  );

  const markViewed = useCallback(async (messageId: string) => {
    await supabase
      .from('messages')
      .update({ viewed_at: new Date().toISOString() })
      .eq('id', messageId);
  }, []);

  const saveMessage = useCallback(async (messageId: string) => {
    await supabase.from('messages').update({ saved: true }).eq('id', messageId);
  }, []);

  const softDeleteMessage = useCallback(async (messageId: string) => {
    await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId);
  }, []);


  const setMessageSaved = useCallback(
    async (messageId: string, save: boolean) => {
      if (save) {
        await supabase.from('messages').update({ saved: true }).eq('id', messageId);
      } else {
        await supabase
          .from('messages')
          .update({ saved: false, deleted_at: new Date().toISOString() })
          .eq('id', messageId);
      }
    },
    [],
  );

  const postSystemMessage = useCallback(
    async (content: string) => {
      if (!profile) return;
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: profile.id,
        content,
        type: 'system',
      });
    },
    [profile, conversationId],
  );

  const markAllReceivedAsViewed = useCallback(async () => {
    if (!profile) return;
    await supabase
      .from('messages')
      .update({ viewed_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', profile.id)
      .is('viewed_at', null);
  }, [profile, conversationId]);

  const cleanupViewedTextOnLeave = useCallback(async () => {
    if (!profile) return;
    await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('type', 'text')
      .neq('sender_id', profile.id)
      .eq('saved', false)
      .is('deleted_at', null);
  }, [profile, conversationId]);

  return {
    messages,
    loading,
    sendTextMessage,
    markViewed,
    saveMessage,
    softDeleteMessage,
    setMessageSaved,
    postSystemMessage,
    markAllReceivedAsViewed,
    cleanupViewedTextOnLeave,
  };
}
