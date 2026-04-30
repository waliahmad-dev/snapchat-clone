import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { supabase } from '@lib/supabase/client';
import { database } from '@lib/watermelondb/database';
import GroupMessage from '@lib/watermelondb/models/GroupMessage';
import GroupMessageView from '@lib/watermelondb/models/GroupMessageView';
import GroupMember from '@lib/watermelondb/models/GroupMember';
import Outbox from '@lib/watermelondb/models/Outbox';
import { useAuthStore } from '@features/auth/store/authStore';
import { enqueueJob } from '@lib/offline/outboxRunner';
import { JOB } from '@lib/offline/jobs';
import { uuid } from '@lib/offline/uuid';
import { MESSAGE_PAGE_SIZE } from '@constants/config';
import type { DbGroupMessage, GroupMessageType } from '@/types/database';

interface RemoteGroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  type: GroupMessageType;
  mentions: string[] | null;
  saved_by: string[] | null;
  reply_to_message_id: string | null;
  created_at: string;
  deleted_at: string | null;
}

interface RemoteGroupView {
  message_id: string;
  user_id: string;
  viewed_at: string;
  screenshot_at: string | null;
}

const messagesCollection = () => database.get<GroupMessage>('group_messages');
const viewsCollection = () => database.get<GroupMessageView>('group_message_views');

function toDbMessage(m: GroupMessage): DbGroupMessage {
  return {
    id: m.id,
    group_id: m.groupId,
    sender_id: m.senderId,
    content: m.content,
    media_url: m.mediaUrl,
    type: m.type,
    mentions: m.mentions,
    saved_by: m.savedBy,
    reply_to_message_id: m.replyToMessageId,
    created_at: new Date(m.createdAt).toISOString(),
    deleted_at: m.deletedAt ? new Date(m.deletedAt).toISOString() : null,
  };
}

async function hasPendingMutation(remoteId: string, prefix: string): Promise<boolean> {
  const rows = await database
    .get<Outbox>('outbox')
    .query(Q.where('group_key', `${prefix}:${remoteId}`))
    .fetch();
  return rows.length > 0;
}

async function upsertRemoteMessage(row: RemoteGroupMessage): Promise<void> {
  const collection = messagesCollection();
  const [savePending, deletePending] = await Promise.all([
    hasPendingMutation(row.id, 'gm-save'),
    hasPendingMutation(row.id, 'gm-del'),
  ]);

  const existing = await collection.query(Q.where('remote_id', row.id)).fetch();
  const mentionsJson = JSON.stringify(row.mentions ?? []);
  const savedByJson = JSON.stringify(row.saved_by ?? []);

  if (existing.length > 0) {
    const target = existing[0];
    await target.update((m) => {
      m.content = row.content;
      m.mediaUrl = row.media_url;
      m.type = row.type;
      m.createdAt = new Date(row.created_at).getTime();
      if (!savePending) m.savedByJson = savedByJson;
      if (!deletePending)
        m.deletedAt = row.deleted_at ? new Date(row.deleted_at).getTime() : null;
      m.mentionsJson = mentionsJson;
      m.replyToMessageId = row.reply_to_message_id;
      m.isOptimistic = false;
    });
    return;
  }

  await collection.create((m) => {
    m.remoteId = row.id;
    m.groupId = row.group_id;
    m.senderId = row.sender_id;
    m.content = row.content;
    m.mediaUrl = row.media_url;
    m.type = row.type;
    m.mentionsJson = mentionsJson;
    m.savedByJson = savedByJson;
    m.replyToMessageId = row.reply_to_message_id;
    m.createdAt = new Date(row.created_at).getTime();
    m.deletedAt = row.deleted_at ? new Date(row.deleted_at).getTime() : null;
    m.isOptimistic = false;
  });
}

async function upsertRemoteView(row: RemoteGroupView): Promise<void> {
  const collection = viewsCollection();
  const existing = await collection
    .query(Q.where('message_id', row.message_id), Q.where('user_id', row.user_id))
    .fetch();
  if (existing.length > 0) {
    const v = existing[0];
    await v.update((row2) => {
      row2.viewedAt = new Date(row.viewed_at).getTime();
      row2.screenshotAt = row.screenshot_at ? new Date(row.screenshot_at).getTime() : null;
    });
    return;
  }
  await collection.create((v) => {
    v.messageId = row.message_id;
    v.userId = row.user_id;
    v.viewedAt = new Date(row.viewed_at).getTime();
    v.screenshotAt = row.screenshot_at ? new Date(row.screenshot_at).getTime() : null;
  });
}

async function findByLocalId(localId: string): Promise<GroupMessage | null> {
  try {
    return await messagesCollection().find(localId);
  } catch {
    return null;
  }
}

export function useGroupMessages(groupId: string) {
  const profile = useAuthStore((s) => s.profile);
  const instanceId = useId();
  const [rawMessages, setRawMessages] = useState<GroupMessage[]>([]);
  const [views, setViews] = useState<GroupMessageView[]>([]);
  const [activeMemberIds, setActiveMemberIds] = useState<string[]>([]);
  const [myJoinedAt, setMyJoinedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    const subM = messagesCollection()
      .query(Q.where('group_id', groupId))
      .observeWithColumns(['saved_by_json', 'deleted_at', 'content', 'media_url'])
      .subscribe((rows) => setRawMessages(rows));
    const subV = viewsCollection()
      .query()
      .observeWithColumns(['viewed_at', 'screenshot_at'])
      .subscribe(setViews);
    const subMembers = database
      .get<GroupMember>('group_members')
      .query(Q.where('group_id', groupId))
      .observeWithColumns(['left_at', 'joined_at'])
      .subscribe((rows) => {
        setActiveMemberIds(rows.filter((r) => r.leftAt == null).map((r) => r.userId));
        const me = profile
          ? rows.find((r) => r.userId === profile.id && r.leftAt == null)
          : undefined;
        setMyJoinedAt(me ? me.joinedAt : null);
      });
    return () => {
      subM.unsubscribe();
      subV.unsubscribe();
      subMembers.unsubscribe();
    };
  }, [groupId, profile?.id]);

  useEffect(() => {
    if (!groupId || !profile) return;
    let cancelled = false;
    syncFromServer().finally(() => {
      if (!cancelled) setLoading(false);
    });

    const channel = supabase
      .channel(`group-messages:${groupId}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        (payload) => {
          const row = payload.new as RemoteGroupMessage | undefined;
          if (!row) return;
          database
            .write(async () => {
              await upsertRemoteMessage(row);
            })
            .catch((err) => console.warn('[GroupMessages] realtime failed:', err));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_message_views' },
        (payload) => {
          const row = payload.new as RemoteGroupView | undefined;
          if (!row) return;
          database
            .write(async () => {
              await upsertRemoteView(row);
            })
            .catch(() => {});
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [groupId, profile?.id, instanceId]);

  async function syncFromServer() {
    if (!groupId || !profile) return;
    try {
      let q = supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', groupId);
      // Only fetch history newer than the user's most recent join. If
      // they left and were re-added, anything before the latest joined_at
      // shouldn't reach them.
      if (myJoinedAt != null) {
        q = q.gte('created_at', new Date(myJoinedAt).toISOString());
      }
      const { data: msgs } = await q
        .order('created_at', { ascending: false })
        .limit(MESSAGE_PAGE_SIZE);
      if (msgs) {
        await database.write(async () => {
          for (const r of msgs as RemoteGroupMessage[]) await upsertRemoteMessage(r);
        });
        const ids = (msgs as RemoteGroupMessage[]).map((m) => m.id);
        if (ids.length > 0) {
          const { data: viewsData } = await supabase
            .from('group_message_views')
            .select('*')
            .in('message_id', ids);
          if (viewsData) {
            await database.write(async () => {
              for (const v of viewsData as RemoteGroupView[]) await upsertRemoteView(v);
            });
          }
        }
      }
    } catch (err) {
      console.warn('[GroupMessages] sync failed:', err);
    }
  }

  // Visibility rule: a message stays visible for everyone — including the
  // user who already viewed it — until *every* active member has viewed
  // it. Saved messages persist forever. The sender counts as a viewer
  // implicitly. (Snapchat-style: messages disappear only once the whole
  // group has seen them.)
  const messages = useMemo<DbGroupMessage[]>(() => {
    if (!profile) return [];
    const viewersByMessage = new Map<string, Set<string>>();
    for (const v of views) {
      const set = viewersByMessage.get(v.messageId) ?? new Set<string>();
      set.add(v.userId);
      viewersByMessage.set(v.messageId, set);
    }

    const memberSet = new Set(activeMemberIds);

    const filtered: DbGroupMessage[] = [];
    for (const m of rawMessages) {
      if (m.deletedAt) continue;
      // Hide anything older than my latest join. Catches the case where
      // a user left and was re-added: only their fresh post-rejoin
      // history should be visible.
      if (myJoinedAt != null && m.createdAt < myJoinedAt) continue;
      // System / saved messages always visible.
      if (m.type === 'system' || m.savedBy.length > 0) {
        filtered.push(toDbMessage(m));
        continue;
      }
      // Sender counts as a viewer implicitly.
      const viewers = viewersByMessage.get(m.remoteId) ?? new Set<string>();
      let allActiveViewed = true;
      for (const memberId of memberSet) {
        if (memberId === m.senderId) continue;
        if (!viewers.has(memberId)) {
          allActiveViewed = false;
          break;
        }
      }
      // No active members other than sender → keep visible (degenerate case).
      if (memberSet.size <= 1) allActiveViewed = false;
      if (allActiveViewed) continue;
      filtered.push(toDbMessage(m));
    }
    filtered.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    return filtered.slice(0, MESSAGE_PAGE_SIZE);
  }, [rawMessages, views, profile, activeMemberIds, myJoinedAt]);

  // ---------- mutations ----------

  const sendTextMessage = useCallback(
    async (
      content: string,
      mentions: string[],
      replyToMessageId: string | null
    ): Promise<void> => {
      if (!profile || !content.trim()) return;
      const trimmed = content.trim();
      const messageId = uuid();
      const mentionsJson = JSON.stringify(mentions);

      await database.write(async () => {
        await messagesCollection().create((m) => {
          m.remoteId = messageId;
          m.groupId = groupId;
          m.senderId = profile.id;
          m.content = trimmed;
          m.mediaUrl = null;
          m.type = 'text';
          m.mentionsJson = mentionsJson;
          m.savedByJson = '[]';
          m.replyToMessageId = replyToMessageId;
          m.createdAt = Date.now();
          m.deletedAt = null;
          m.isOptimistic = true;
        });
      });

      await enqueueJob({
        kind: JOB.GROUP_MESSAGE_SEND,
        payload: {
          messageId,
          groupId,
          senderId: profile.id,
          content: trimmed,
          mediaUrl: null,
          type: 'text',
          mentions,
          replyToMessageId,
        },
        groupKey: `gm-send:${messageId}`,
      });
    },
    [profile, groupId]
  );

  const markViewed = useCallback(
    async (localOrRemoteMessageId: string) => {
      if (!profile) return;
      // Resolve local row -> remoteId if needed
      let remoteId = localOrRemoteMessageId;
      const local = await findByLocalId(localOrRemoteMessageId);
      if (local) remoteId = local.remoteId;
      if (!remoteId) return;

      // Don't mark own messages
      const target = await messagesCollection()
        .query(Q.where('remote_id', remoteId))
        .fetch();
      if (target.length > 0 && target[0].senderId === profile.id) return;

      // Already viewed?
      const existing = await viewsCollection()
        .query(Q.where('message_id', remoteId), Q.where('user_id', profile.id))
        .fetch();
      if (existing.length > 0) return;

      await database.write(async () => {
        await viewsCollection().create((v) => {
          v.messageId = remoteId;
          v.userId = profile.id;
          v.viewedAt = Date.now();
          v.screenshotAt = null;
        });
      });

      await enqueueJob({
        kind: JOB.GROUP_MESSAGE_VIEW,
        payload: { messageId: remoteId, userId: profile.id },
        groupKey: `gm-view:${remoteId}:${profile.id}`,
      });
    },
    [profile]
  );

  const markAllReceivedAsViewed = useCallback(async () => {
    if (!profile) return;
    const viewedIds = new Set(
      (
        await viewsCollection().query(Q.where('user_id', profile.id)).fetch()
      ).map((v) => v.messageId)
    );

    const fresh = await messagesCollection()
      .query(
        Q.where('group_id', groupId),
        Q.where('sender_id', Q.notEq(profile.id)),
        Q.where('deleted_at', null)
      )
      .fetch();

    const targets = fresh.filter(
      (m) => m.type !== 'system' && m.type !== 'media' && !viewedIds.has(m.remoteId)
    );
    if (targets.length === 0) return;

    await database.write(async () => {
      for (const t of targets) {
        await viewsCollection().create((v) => {
          v.messageId = t.remoteId;
          v.userId = profile.id;
          v.viewedAt = Date.now();
          v.screenshotAt = null;
        });
      }
    });

    for (const t of targets) {
      await enqueueJob({
        kind: JOB.GROUP_MESSAGE_VIEW,
        payload: { messageId: t.remoteId, userId: profile.id },
        groupKey: `gm-view:${t.remoteId}:${profile.id}`,
      });
    }
  }, [profile, groupId]);

  const setMessageSaved = useCallback(
    async (localOrRemoteId: string, save: boolean) => {
      const local = await findByLocalId(localOrRemoteId);
      const remoteId = local?.remoteId ?? localOrRemoteId;
      if (!profile || !remoteId) return;

      // Optimistically update saved_by[]
      const target = (
        await messagesCollection().query(Q.where('remote_id', remoteId)).fetch()
      )[0];
      if (target) {
        const next = new Set(target.savedBy);
        if (save) next.add(profile.id);
        else next.delete(profile.id);
        await database.write(async () => {
          await target.update((m) => {
            m.savedByJson = JSON.stringify([...next]);
          });
        });
      }

      await enqueueJob({
        kind: JOB.GROUP_MESSAGE_SAVE,
        payload: { messageId: remoteId, save },
        groupKey: `gm-save:${remoteId}`,
      });
    },
    [profile]
  );

  const softDeleteMessage = useCallback(async (localOrRemoteId: string) => {
    const local = await findByLocalId(localOrRemoteId);
    const remoteId = local?.remoteId ?? localOrRemoteId;
    if (!remoteId) return;

    const target = (
      await messagesCollection().query(Q.where('remote_id', remoteId)).fetch()
    )[0];
    if (target) {
      await database.write(async () => {
        await target.update((m) => {
          m.deletedAt = Date.now();
        });
      });
    }

    await enqueueJob({
      kind: JOB.GROUP_MESSAGE_DELETE,
      payload: { messageId: remoteId },
      groupKey: `gm-del:${remoteId}`,
    });
  }, []);

  const postSystemMessage = useCallback(
    async (content: string) => {
      if (!profile) return;
      const messageId = uuid();

      await database.write(async () => {
        await messagesCollection().create((m) => {
          m.remoteId = messageId;
          m.groupId = groupId;
          m.senderId = profile.id;
          m.content = content;
          m.mediaUrl = null;
          m.type = 'system';
          m.mentionsJson = '[]';
          m.savedByJson = '[]';
          m.replyToMessageId = null;
          m.createdAt = Date.now();
          m.deletedAt = null;
          m.isOptimistic = true;
        });
      });

      await enqueueJob({
        kind: JOB.GROUP_SYSTEM_MESSAGE,
        payload: { messageId, groupId, senderId: profile.id, content },
        groupKey: `group-sysmsg:${messageId}`,
      });
    },
    [profile, groupId]
  );

  const viewedByMeIds = useMemo(() => {
    if (!profile) return new Set<string>();
    return new Set(views.filter((v) => v.userId === profile.id).map((v) => v.messageId));
  }, [views, profile]);

  return {
    messages,
    loading,
    viewedByMeIds,
    sendTextMessage,
    markViewed,
    markAllReceivedAsViewed,
    setMessageSaved,
    softDeleteMessage,
    postSystemMessage,
    refresh: syncFromServer,
  };
}
