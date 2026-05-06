import { Q } from '@nozbe/watermelondb';
import { database } from '@lib/watermelondb/database';
import Conversation from '@lib/watermelondb/models/Conversation';
import Message from '@lib/watermelondb/models/Message';
import GroupMessage from '@lib/watermelondb/models/GroupMessage';
import { enqueueJob } from '@lib/offline/outboxRunner';
import { JOB, type SnapSendJob } from '@lib/offline/jobs';
import { persistMedia } from '@lib/offline/persistMedia';
import { uuid } from '@lib/offline/uuid';

export interface SendSnapOptions {
  senderId: string;
  senderName: string;
  imageUri: string;
  recipientIds: string[];
  postToMyStory?: boolean;
  groupIds?: string[];
}

export async function sendSnapToRecipients({
  senderId,
  senderName,
  imageUri,
  recipientIds,
  postToMyStory = false,
  groupIds = [],
}: SendSnapOptions): Promise<void> {
  if (recipientIds.length === 0 && groupIds.length === 0 && !postToMyStory) return;
  void senderName;

  const batchId = uuid();
  const persistedUri = await persistMedia(imageUri, `snap_${batchId}.jpg`);

  const fullPath = `${senderId}/${batchId}_full.jpg`;
  const thumbPath = `${senderId}/${batchId}_thumb.jpg`;
  const storyId = postToMyStory ? uuid() : null;
  const storyPath = postToMyStory ? `${senderId}/${batchId}_story.jpg` : null;

  const snapIds: Record<string, string> = {};
  const snapMessageIds: Record<string, string> = {};
  const systemMessageIds: Record<string, string> = {};
  const conversationIds: Record<string, string> = {};
  const groupMessageIds: Record<string, string> = {};

  for (const rid of recipientIds) {
    snapIds[rid] = uuid();
    snapMessageIds[rid] = uuid();
    systemMessageIds[rid] = uuid();
  }
  for (const gid of groupIds) {
    groupMessageIds[gid] = uuid();
  }

  await database.write(async () => {
    for (const rid of recipientIds) {
      const [p1, p2] = [senderId, rid].sort();
      const matches = await database
        .get<Conversation>('conversations')
        .query(Q.where('participant_1_id', p1), Q.where('participant_2_id', p2))
        .fetch();
      const conv = matches[0];
      if (!conv) continue;
      conversationIds[rid] = conv.remoteId;

      await database.get<Message>('messages').create((m) => {
        m.remoteId = '';
        m.conversationId = conv.remoteId;
        m.senderId = senderId;
        m.content = null;
        m.mediaUrl = fullPath;
        m.type = 'snap';
        m.createdAt = Date.now();
        m.viewedAt = null;
        m.savedByJson = '[]';
        m.deletedAt = null;
        m.replyToMessageId = null;
        m.isOptimistic = true;
        m.hiddenLocally = false;
      });
    }

    for (const gid of groupIds) {
      await database.get<GroupMessage>('group_messages').create((m) => {
        m.remoteId = groupMessageIds[gid];
        m.groupId = gid;
        m.senderId = senderId;
        m.content = null;
        m.mediaUrl = fullPath;
        m.type = 'media';
        m.mentionsJson = '[]';
        m.savedByJson = '[]';
        m.replyToMessageId = null;
        m.createdAt = Date.now();
        m.deletedAt = null;
        m.isOptimistic = true;
      });
    }
  });

  const job: SnapSendJob = {
    senderId,
    imageUri: persistedUri,
    recipientIds,
    postToMyStory,
    fullPath,
    thumbPath,
    storyPath,
    storyId,
    snapIds,
    snapMessageIds,
    systemMessageIds,
    conversationIds,
    groupIds,
    groupMessageIds,
  };

  await enqueueJob({
    kind: JOB.SNAP_SEND,
    payload: job,
    groupKey: `snap:${batchId}`,
  });
}
