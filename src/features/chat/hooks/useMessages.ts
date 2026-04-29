import { useEffect, useId, useState, useCallback } from 'react';
import { Q } from '@nozbe/watermelondb';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';
import type { DbMessage, MessageType } from '@/types/database';
import { MESSAGE_PAGE_SIZE } from '@constants/config';
import { database } from '@lib/watermelondb/database';
import Message from '@lib/watermelondb/models/Message';
import Outbox from '@lib/watermelondb/models/Outbox';
import { enqueueJob } from '@lib/offline/outboxRunner';
import { JOB } from '@lib/offline/jobs';
import { uuid } from '@lib/offline/uuid';

interface RemoteMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  type: MessageType;
  created_at: string;
  viewed_at: string | null;
  saved: boolean;
  deleted_at: string | null;
  reply_to_message_id?: string | null;
}

const messagesCollection = () => database.get<Message>('messages');

function toDbMessage(m: Message): DbMessage {
  return {
    id: m.id,
    conversation_id: m.conversationId,
    sender_id: m.senderId,
    content: m.content,
    media_url: m.mediaUrl,
    type: m.type,
    created_at: new Date(m.createdAt).toISOString(),
    viewed_at: m.viewedAt ? new Date(m.viewedAt).toISOString() : null,
    saved: m.saved,
    deleted_at: m.deletedAt ? new Date(m.deletedAt).toISOString() : null,
    reply_to_message_id: m.replyToMessageId ?? null,
  };
}

async function findOptimisticMatch(row: RemoteMessageRow): Promise<Message | null> {
  const candidates = await messagesCollection()
    .query(
      Q.where('is_optimistic', true),
      Q.where('conversation_id', row.conversation_id),
      Q.where('sender_id', row.sender_id),
      Q.where('type', row.type),
      Q.where('content', row.content ?? null),
    )
    .fetch();
  if (candidates.length === 0) return null;
  return candidates.slice().sort((a, b) => a.createdAt - b.createdAt)[0];
}

async function hasPendingMutation(remoteId: string, prefix: string): Promise<boolean> {
  const rows = await database
    .get<Outbox>('outbox')
    .query(Q.where('group_key', `${prefix}:${remoteId}`))
    .fetch();
  return rows.length > 0;
}

async function upsertRemoteRow(row: RemoteMessageRow): Promise<void> {
  const collection = messagesCollection();

  const [savePending, viewPending, deletePending] = await Promise.all([
    hasPendingMutation(row.id, 'msg-save'),
    hasPendingMutation(row.id, 'msg-view'),
    hasPendingMutation(row.id, 'msg-del'),
  ]);

  const existing = await collection.query(Q.where('remote_id', row.id)).fetch();
  if (existing.length > 0) {
    const target = existing[0];
    await target.update((m) => {
      m.content = row.content;
      m.mediaUrl = row.media_url;
      m.type = row.type;
      m.createdAt = new Date(row.created_at).getTime();
      if (!viewPending) m.viewedAt = row.viewed_at ? new Date(row.viewed_at).getTime() : null;
      if (!savePending) m.saved = row.saved;
      if (!deletePending) m.deletedAt = row.deleted_at ? new Date(row.deleted_at).getTime() : null;
      m.replyToMessageId = row.reply_to_message_id ?? null;
      m.isOptimistic = false;
    });
    return;
  }

  const optimistic = await findOptimisticMatch(row);
  if (optimistic) {
    await optimistic.update((m) => {
      m.remoteId = row.id;
      m.createdAt = new Date(row.created_at).getTime();
      if (!viewPending) m.viewedAt = row.viewed_at ? new Date(row.viewed_at).getTime() : null;
      if (!savePending) m.saved = row.saved;
      if (!deletePending) m.deletedAt = row.deleted_at ? new Date(row.deleted_at).getTime() : null;
      m.mediaUrl = row.media_url;
      m.replyToMessageId = row.reply_to_message_id ?? null;
      m.isOptimistic = false;
    });
    return;
  }

  await collection.create((m) => {
    m.remoteId = row.id;
    m.conversationId = row.conversation_id;
    m.senderId = row.sender_id;
    m.content = row.content;
    m.mediaUrl = row.media_url;
    m.type = row.type;
    m.createdAt = new Date(row.created_at).getTime();
    m.viewedAt = row.viewed_at ? new Date(row.viewed_at).getTime() : null;
    m.saved = row.saved;
    m.deletedAt = row.deleted_at ? new Date(row.deleted_at).getTime() : null;
    m.replyToMessageId = row.reply_to_message_id ?? null;
    m.isOptimistic = false;
  });
}

async function findByLocalId(localId: string): Promise<Message | null> {
  try {
    return await messagesCollection().find(localId);
  } catch {
    return null;
  }
}

export function useMessages(conversationId: string) {
  const profile = useAuthStore((s) => s.profile);
  const instanceId = useId();
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) return;
    const sub = messagesCollection()
      .query(
        Q.where('conversation_id', conversationId),
        Q.where('deleted_at', null),
      )
      .observe()
      .subscribe((rows) => {
        const sorted = rows
          .slice()
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, MESSAGE_PAGE_SIZE)
          .map(toDbMessage);
        setMessages(sorted);
      });
    return () => sub.unsubscribe();
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !profile) return;
    let cancelled = false;

    syncFromServer().finally(() => {
      if (!cancelled) setLoading(false);
    });

    const channel = supabase
      .channel(`messages:${conversationId}:${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as RemoteMessageRow;
          database
            .write(async () => {
              await upsertRemoteRow(row);
            })
            .catch((err) => console.warn('[Messages] realtime INSERT failed:', err));
        },
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
          const row = payload.new as RemoteMessageRow;
          database
            .write(async () => {
              await upsertRemoteRow(row);
            })
            .catch((err) => console.warn('[Messages] realtime UPDATE failed:', err));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [conversationId, profile?.id, instanceId]);

  async function syncFromServer() {
    if (!conversationId) return;
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_PAGE_SIZE);

      if (!data || data.length === 0) return;

      await database.write(async () => {
        for (const row of data as RemoteMessageRow[]) {
          await upsertRemoteRow(row);
        }
      });
    } catch (err) {
      console.warn('[Messages] sync failed:', err);
    }
  }

  const sendTextMessage = useCallback(
    async (content: string, replyToMessageId?: string | null): Promise<void> => {
      if (!profile || !content.trim()) return;
      const trimmed = content.trim();

      let replyRemoteId: string | null = null;
      if (replyToMessageId) {
        const local = await findByLocalId(replyToMessageId);
        replyRemoteId = local?.remoteId || replyToMessageId;
      }

      const messageRemoteId = uuid();

      await database.write(async () => {
        await messagesCollection().create((m) => {
          m.remoteId = messageRemoteId;
          m.conversationId = conversationId;
          m.senderId = profile.id;
          m.content = trimmed;
          m.mediaUrl = null;
          m.type = 'text';
          m.createdAt = Date.now();
          m.viewedAt = null;
          m.saved = false;
          m.deletedAt = null;
          m.replyToMessageId = replyRemoteId;
          m.isOptimistic = true;
        });
      });

      await enqueueJob({
        kind: JOB.MESSAGE_SEND,
        payload: {
          messageId: messageRemoteId,
          conversationId,
          senderId: profile.id,
          content: trimmed,
          type: 'text',
          replyToMessageId: replyRemoteId,
        },
        groupKey: `message:${messageRemoteId}`,
      });

      await enqueueJob({
        kind: JOB.CONVERSATION_TOUCH,
        payload: { conversationId },
        groupKey: `conv-touch:${conversationId}`,
      });
    },
    [profile, conversationId],
  );

  const markViewed = useCallback(async (localId: string) => {
    const target = await findByLocalId(localId);
    if (!target) return;
    const remoteId = target.remoteId;
    if (!remoteId) return;
    if (target.viewedAt) return;

    const ts = new Date().toISOString();
    await database.write(async () => {
      await target.update((m) => {
        m.viewedAt = Date.parse(ts);
      });
    });
    await enqueueJob({
      kind: JOB.MESSAGE_VIEW,
      payload: { messageId: remoteId, field: 'viewed_at', value: ts },
      groupKey: `msg-view:${remoteId}`,
    });
  }, []);

  const saveMessage = useCallback(async (localId: string) => {
    const target = await findByLocalId(localId);
    if (!target?.remoteId) return;
    await database.write(async () => {
      await target.update((m) => {
        m.saved = true;
      });
    });
    await enqueueJob({
      kind: JOB.MESSAGE_SAVE,
      payload: { messageId: target.remoteId, field: 'saved', value: true },
      groupKey: `msg-save:${target.remoteId}`,
    });
  }, []);

  const softDeleteMessage = useCallback(async (localId: string) => {
    const target = await findByLocalId(localId);
    if (!target?.remoteId) return;
    const ts = new Date().toISOString();
    await database.write(async () => {
      await target.update((m) => {
        m.deletedAt = Date.parse(ts);
      });
    });
    await enqueueJob({
      kind: JOB.MESSAGE_DELETE,
      payload: { messageId: target.remoteId, field: 'deleted_at', value: ts },
      groupKey: `msg-del:${target.remoteId}`,
    });
  }, []);

  const setMessageSaved = useCallback(async (localId: string, save: boolean) => {
    const target = await findByLocalId(localId);
    if (!target?.remoteId) return;
    const wasViewed = target.viewedAt != null;
    const ts = new Date().toISOString();
    await database.write(async () => {
      await target.update((m) => {
        m.saved = save;
        if (!save && wasViewed) m.deletedAt = Date.parse(ts);
      });
    });
    await enqueueJob({
      kind: JOB.MESSAGE_SAVE,
      payload: { messageId: target.remoteId, field: 'saved', value: save },
      groupKey: `msg-save:${target.remoteId}`,
    });
    if (!save && wasViewed) {
      await enqueueJob({
        kind: JOB.MESSAGE_DELETE,
        payload: { messageId: target.remoteId, field: 'deleted_at', value: ts },
        groupKey: `msg-del:${target.remoteId}`,
      });
    }
  }, []);

  const postSystemMessage = useCallback(
    async (content: string) => {
      if (!profile) return;
      const messageRemoteId = uuid();

      await database.write(async () => {
        await messagesCollection().create((m) => {
          m.remoteId = messageRemoteId;
          m.conversationId = conversationId;
          m.senderId = profile.id;
          m.content = content;
          m.mediaUrl = null;
          m.type = 'system';
          m.createdAt = Date.now();
          m.viewedAt = null;
          m.saved = false;
          m.deletedAt = null;
          m.replyToMessageId = null;
          m.isOptimistic = true;
        });
      });

      await enqueueJob({
        kind: JOB.SYSTEM_MESSAGE,
        payload: {
          messageId: messageRemoteId,
          conversationId,
          senderId: profile.id,
          content,
        },
        groupKey: `sysmsg:${messageRemoteId}`,
      });
    },
    [profile, conversationId],
  );

  const markAllReceivedAsViewed = useCallback(async () => {
    if (!profile) return;
    const ts = new Date().toISOString();
    const tsMs = Date.parse(ts);

    const local = await messagesCollection()
      .query(
        Q.where('conversation_id', conversationId),
        Q.where('sender_id', Q.notEq(profile.id)),
        Q.where('viewed_at', null),
      )
      .fetch();
    if (local.length === 0) return;

    await database.write(async () => {
      for (const m of local) {
        await m.update((row) => {
          row.viewedAt = tsMs;
        });
      }
    });

    for (const m of local) {
      if (!m.remoteId) continue;
      await enqueueJob({
        kind: JOB.MESSAGE_VIEW,
        payload: { messageId: m.remoteId, field: 'viewed_at', value: ts },
        groupKey: `msg-view:${m.remoteId}`,
      });
    }
  }, [profile, conversationId]);

  const cleanupViewedTextOnLeave = useCallback(async () => {
    if (!profile) return;
    const ts = new Date().toISOString();
    const tsMs = Date.parse(ts);

    const local = await messagesCollection()
      .query(
        Q.where('conversation_id', conversationId),
        Q.where('type', 'text'),
        Q.where('sender_id', Q.notEq(profile.id)),
        Q.where('saved', false),
        Q.where('deleted_at', null),
      )
      .fetch();
    if (local.length === 0) return;

    await database.write(async () => {
      for (const m of local) {
        await m.update((row) => {
          row.deletedAt = tsMs;
        });
      }
    });

    for (const m of local) {
      if (!m.remoteId) continue;
      await enqueueJob({
        kind: JOB.MESSAGE_DELETE,
        payload: { messageId: m.remoteId, field: 'deleted_at', value: ts },
        groupKey: `msg-del:${m.remoteId}`,
      });
    }
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
