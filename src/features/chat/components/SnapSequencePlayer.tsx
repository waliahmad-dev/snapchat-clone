import React, { useCallback, useEffect, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '@lib/watermelondb/database';
import Message from '@lib/watermelondb/models/Message';
import { SnapViewer } from './SnapViewer';
import { enqueueJob } from '@lib/offline/outboxRunner';
import { JOB } from '@lib/offline/jobs';
import { uuid } from '@lib/offline/uuid';
import { useAuthStore } from '@features/auth/store/authStore';
import { encodeSystemEvent } from '@lib/i18n/systemEvent';
import type { DbMessage, MessageType } from '@/types/database';

interface Props {
  messageIds: string[];
  myName: string;
  conversationId: string;
  onFinish: () => void;
}

function toDbMessage(m: Message): DbMessage {
  return {
    id: m.id,
    conversation_id: m.conversationId,
    sender_id: m.senderId,
    content: m.content,
    media_url: m.mediaUrl,
    type: m.type as MessageType,
    created_at: new Date(m.createdAt).toISOString(),
    viewed_at: m.viewedAt ? new Date(m.viewedAt).toISOString() : null,
    saved_by: m.savedBy,
    deleted_at: m.deletedAt ? new Date(m.deletedAt).toISOString() : null,
    reply_to_message_id: m.replyToMessageId ?? null,
  };
}

export function SnapSequencePlayer({ messageIds, myName, conversationId, onFinish }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const [index, setIndex] = useState(0);
  const [rows, setRows] = useState<DbMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (messageIds.length === 0) {
      onFinish();
      return;
    }
    let cancelled = false;
    (async () => {
      const messages = await database
        .get<Message>('messages')
        .query(Q.where('remote_id', Q.oneOf(messageIds)))
        .fetch();
      if (cancelled) return;
      const byRemoteId = new Map(messages.map((m) => [m.remoteId, m]));
      const ordered = messageIds
        .map((id) => byRemoteId.get(id))
        .filter((m): m is Message => !!m)
        .map(toDbMessage);
      setRows(ordered);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [messageIds, onFinish]);

  const current = rows[index];

  const advance = useCallback(
    async (savedInSession: boolean) => {
      if (!current) return;
      if (!savedInSession) {
        const ts = new Date().toISOString();
        const local = await database
          .get<Message>('messages')
          .query(Q.where('remote_id', current.id))
          .fetch();
        if (local.length > 0) {
          await database.write(async () => {
            await local[0].update((m) => {
              m.deletedAt = Date.parse(ts);
            });
          });
        }
        await enqueueJob({
          kind: JOB.MESSAGE_DELETE,
          payload: { messageId: current.id, field: 'deleted_at', value: ts },
          groupKey: `msg-del:${current.id}`,
        });
      }
      if (index + 1 >= rows.length) {
        onFinish();
      } else {
        setIndex((i) => i + 1);
      }
    },
    [current, index, rows.length, onFinish],
  );

  const onSave = useCallback(async () => {
    if (!current || !profile) return;
    const local = await database
      .get<Message>('messages')
      .query(Q.where('remote_id', current.id))
      .fetch();
    if (local.length > 0) {
      const next = new Set(local[0].savedBy);
      next.add(profile.id);
      await database.write(async () => {
        await local[0].update((m) => {
          m.savedByJson = JSON.stringify([...next]);
        });
      });
    }
    await enqueueJob({
      kind: JOB.MESSAGE_SAVE,
      payload: { messageId: current.id, save: true },
      groupKey: `msg-save:${current.id}`,
    });

    const sysId = uuid();
    const sysContent = encodeSystemEvent('chat.savedSnap', { name: myName });
    await database.write(async () => {
      await database.get<Message>('messages').create((m) => {
        m.remoteId = sysId;
        m.conversationId = conversationId;
        m.senderId = current.sender_id;
        m.content = sysContent;
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
    await enqueueJob({
      kind: JOB.SYSTEM_MESSAGE,
      payload: {
        messageId: sysId,
        conversationId,
        senderId: current.sender_id,
        content: sysContent,
      },
      groupKey: `sysmsg:${sysId}`,
    });
  }, [current, conversationId, myName, profile]);

  const onUnsave = useCallback(async () => {
    if (!current || !profile) return;
    const ts = new Date().toISOString();
    const local = await database
      .get<Message>('messages')
      .query(Q.where('remote_id', current.id))
      .fetch();
    if (local.length > 0) {
      const next = new Set(local[0].savedBy);
      next.delete(profile.id);
      const stillSaved = next.size > 0;
      await database.write(async () => {
        await local[0].update((m) => {
          m.savedByJson = JSON.stringify([...next]);
          if (!stillSaved) m.deletedAt = Date.parse(ts);
        });
      });
      await enqueueJob({
        kind: JOB.MESSAGE_SAVE,
        payload: { messageId: current.id, save: false },
        groupKey: `msg-save:${current.id}`,
      });
      // Only soft-delete the message globally when no participant has it
      // saved any more — otherwise the other user keeps their saved copy.
      if (!stillSaved) {
        await enqueueJob({
          kind: JOB.MESSAGE_DELETE,
          payload: { messageId: current.id, field: 'deleted_at', value: ts },
          groupKey: `msg-del:${current.id}`,
        });
      }
    }
  }, [current, profile]);

  if (loading || !current || !current.media_url) return null;

  return (
    <SnapViewer
      key={current.id}
      mediaPath={current.media_url}
      isOwn={false}
      alreadySaved={current.saved_by.length > 0}
      onClose={(savedInSession) => advance(savedInSession)}
      onSave={onSave}
      onUnsave={onUnsave}
    />
  );
}
