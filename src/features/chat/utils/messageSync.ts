import { Q } from '@nozbe/watermelondb';
import { database } from '@lib/watermelondb/database';
import Message from '@lib/watermelondb/models/Message';
import Outbox from '@lib/watermelondb/models/Outbox';
import type { MessageType } from '@/types/database';

export interface RemoteMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  type: MessageType;
  created_at: string;
  viewed_at: string | null;
  saved_by: string[] | null;
  deleted_at: string | null;
  reply_to_message_id?: string | null;
}

const messagesCollection = () => database.get<Message>('messages');

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

/**
 * Idempotent upsert from a server `messages` row into local WatermelonDB.
 * Must be called inside a `database.write(...)` transaction.
 */
export async function upsertRemoteMessage(row: RemoteMessageRow): Promise<void> {
  const collection = messagesCollection();

  const [savePending, viewPending, deletePending] = await Promise.all([
    hasPendingMutation(row.id, 'msg-save'),
    hasPendingMutation(row.id, 'msg-view'),
    hasPendingMutation(row.id, 'msg-del'),
  ]);

  const savedByJson = JSON.stringify(row.saved_by ?? []);

  const existing = await collection.query(Q.where('remote_id', row.id)).fetch();
  if (existing.length > 0) {
    const target = existing[0];
    await target.update((m) => {
      m.content = row.content;
      m.mediaUrl = row.media_url;
      m.type = row.type;
      m.createdAt = new Date(row.created_at).getTime();
      if (!viewPending) m.viewedAt = row.viewed_at ? new Date(row.viewed_at).getTime() : null;
      if (!savePending) m.savedByJson = savedByJson;
      if (!deletePending) m.deletedAt = row.deleted_at ? new Date(row.deleted_at).getTime() : null;
      m.replyToMessageId = row.reply_to_message_id ?? null;
      m.isOptimistic = false;
      // hidden_locally is a per-device flag — never overwrite from server.
    });
    return;
  }

  const optimistic = await findOptimisticMatch(row);
  if (optimistic) {
    await optimistic.update((m) => {
      m.remoteId = row.id;
      m.createdAt = new Date(row.created_at).getTime();
      if (!viewPending) m.viewedAt = row.viewed_at ? new Date(row.viewed_at).getTime() : null;
      if (!savePending) m.savedByJson = savedByJson;
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
    m.savedByJson = savedByJson;
    m.deletedAt = row.deleted_at ? new Date(row.deleted_at).getTime() : null;
    m.replyToMessageId = row.reply_to_message_id ?? null;
    m.isOptimistic = false;
    m.hiddenLocally = false;
  });
}
