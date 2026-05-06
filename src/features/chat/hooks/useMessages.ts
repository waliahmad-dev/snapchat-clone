import { useEffect, useId, useState, useCallback, useRef } from 'react';
import { Q } from '@nozbe/watermelondb';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';
import type { DbMessage } from '@/types/database';
import { MESSAGE_PAGE_SIZE } from '@constants/config';
import { database } from '@lib/watermelondb/database';
import Message from '@lib/watermelondb/models/Message';
import { enqueueJob } from '@lib/offline/outboxRunner';
import { JOB } from '@lib/offline/jobs';
import { uuid } from '@lib/offline/uuid';
import { upsertRemoteMessage, type RemoteMessageRow } from '../utils/messageSync';

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
    saved_by: m.savedBy,
    deleted_at: m.deletedAt ? new Date(m.deletedAt).toISOString() : null,
    reply_to_message_id: m.replyToMessageId ?? null,
  };
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
  const [displayLimit, setDisplayLimit] = useState(MESSAGE_PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loadingMoreRef = useRef(false);

  // Reset pagination when switching conversations.
  useEffect(() => {
    setDisplayLimit(MESSAGE_PAGE_SIZE);
    setHasMore(true);
    setLoadingMore(false);
    loadingMoreRef.current = false;
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    const sub = messagesCollection()
      .query(
        Q.where('conversation_id', conversationId),
        Q.where('deleted_at', null),
        Q.where('hidden_locally', Q.notEq(true)),
      )
      // observeWithColumns re-emits when *fields* on existing rows change
      // (saved_by_json/viewed_at/content), not just on insert/delete. Without
      // it, toggling save on a message wouldn't propagate the new value to
      // the bubble, so a follow-up tap would read stale state.
      .observeWithColumns(['saved_by_json', 'viewed_at', 'content', 'media_url'])
      .subscribe((rows) => {
        const sorted = rows
          .slice()
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, displayLimit)
          .map(toDbMessage);
        setMessages(sorted);
      });
    return () => sub.unsubscribe();
  }, [conversationId, displayLimit]);

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
              await upsertRemoteMessage(row);
            })
            .catch((err) => console.warn('[Messages] realtime INSERT failed:', err));
          // Grow the slice so an incoming message never pushes a previously
          // loaded older message off the visible window.
          setDisplayLimit((n) => n + 1);
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
              await upsertRemoteMessage(row);
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

      if (!data) return;
      if (data.length < MESSAGE_PAGE_SIZE) setHasMore(false);
      if (data.length === 0) return;

      await database.write(async () => {
        for (const row of data as RemoteMessageRow[]) {
          await upsertRemoteMessage(row);
        }
      });
    } catch (err) {
      console.warn('[Messages] sync failed:', err);
    }
  }

  /**
   * Fetch the next page of older messages from the server, append them to
   * the local cache, and grow the slice window so the new rows render at the
   * visual top of the inverted FlatList.
   *
   * The ref guard prevents overlapping fetches when onEndReached fires
   * multiple times in a row during a fast scroll.
   */
  const loadMore = useCallback(async (): Promise<void> => {
    if (loadingMoreRef.current) return;
    if (!hasMore) return;
    if (!conversationId) return;
    if (messages.length === 0) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const oldestIso = messages[messages.length - 1].created_at;
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .lt('created_at', oldestIso)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_PAGE_SIZE);
      if (error) throw error;

      const fetched = (data ?? []) as RemoteMessageRow[];
      if (fetched.length < MESSAGE_PAGE_SIZE) setHasMore(false);

      if (fetched.length > 0) {
        await database.write(async () => {
          for (const row of fetched) {
            await upsertRemoteMessage(row);
          }
        });
      }

      // Always grow the slice so any cached-but-not-yet-rendered older
      // messages also become visible on offline / partial-page scrolls.
      setDisplayLimit((n) => n + MESSAGE_PAGE_SIZE);
    } catch (err) {
      console.warn('[Messages] loadMore failed:', err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [conversationId, messages, hasMore]);

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
          m.savedByJson = '[]';
          m.deletedAt = null;
          m.replyToMessageId = replyRemoteId;
          m.isOptimistic = true;
          m.hiddenLocally = false;
        });
      });
      // Grow the slice so previously loaded older messages don't fall off
      // when this new row arrives at the top.
      setDisplayLimit((n) => n + 1);

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

  const saveMessage = useCallback(
    async (localId: string) => {
      const target = await findByLocalId(localId);
      if (!target?.remoteId || !profile) return;
      const next = new Set(target.savedBy);
      if (next.has(profile.id)) return;
      next.add(profile.id);
      await database.write(async () => {
        await target.update((m) => {
          m.savedByJson = JSON.stringify([...next]);
        });
      });
      await enqueueJob({
        kind: JOB.MESSAGE_SAVE,
        payload: { messageId: target.remoteId, save: true },
        groupKey: `msg-save:${target.remoteId}`,
      });
    },
    [profile],
  );

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

  const setMessageSaved = useCallback(
    async (localId: string, save: boolean) => {
      const target = await findByLocalId(localId);
      if (!target?.remoteId || !profile) return;
      // Per-user save state: this only adds/removes the current user's id
      // from saved_by[]. The message stays visible globally as long as at
      // least one participant has saved it. hideViewedReceivedOnLeave drops
      // unsaved received messages locally on exit; the server chat_presence
      // trigger destroys rows once both participants are out and saved_by is
      // empty.
      const next = new Set(target.savedBy);
      if (save) next.add(profile.id);
      else next.delete(profile.id);
      await database.write(async () => {
        await target.update((m) => {
          m.savedByJson = JSON.stringify([...next]);
        });
      });
      await enqueueJob({
        kind: JOB.MESSAGE_SAVE,
        payload: { messageId: target.remoteId, save },
        groupKey: `msg-save:${target.remoteId}`,
      });
    },
    [profile],
  );

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
          m.savedByJson = '[]';
          m.deletedAt = null;
          m.replyToMessageId = null;
          m.isOptimistic = true;
          m.hiddenLocally = false;
        });
      });
      setDisplayLimit((n) => n + 1);

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

  /**
   * Local-only hide of unsaved received messages on leave. The server row
   * stays alive so the sender keeps seeing it while they're still in the
   * chat — true destruction happens server-side via the chat_presence
   * trigger once both participants are out and saved_by is empty.
   */
  const hideViewedReceivedOnLeave = useCallback(async () => {
    if (!profile) return;

    const local = await messagesCollection()
      .query(
        Q.where('conversation_id', conversationId),
        Q.where('sender_id', Q.notEq(profile.id)),
        Q.where('deleted_at', null),
        Q.where('hidden_locally', Q.notEq(true)),
        Q.where('type', Q.oneOf(['text', 'media', 'snap'])),
        Q.where('viewed_at', Q.notEq(null)),
      )
      .fetch();
    // Filter saved_by in JS — it lives in a JSON-serialised text column,
    // which WatermelonDB's query layer can't introspect directly. A message
    // counts as "unsaved" only when no participant has saved it.
    const targets = local.filter((m) => m.savedBy.length === 0);
    if (targets.length === 0) return;

    await database.write(async () => {
      for (const m of targets) {
        await m.update((row) => {
          row.hiddenLocally = true;
        });
      }
    });
  }, [profile, conversationId]);

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    sendTextMessage,
    markViewed,
    saveMessage,
    softDeleteMessage,
    setMessageSaved,
    postSystemMessage,
    markAllReceivedAsViewed,
    hideViewedReceivedOnLeave,
  };
}
