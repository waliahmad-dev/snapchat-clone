import { Q } from '@nozbe/watermelondb';
import { supabase } from '@lib/supabase/client';
import { uploadToStorage } from '@lib/supabase/storage';
import { processImage } from '@lib/imageManipulator/processor';
import { recordSnapSent } from '@lib/redis/streak';
import { database } from '@lib/watermelondb/database';
import Memory from '@lib/watermelondb/models/Memory';
import Message from '@lib/watermelondb/models/Message';
import Friend from '@lib/watermelondb/models/Friend';
import { ensureConversation } from '@features/chat/utils/conversation';
import { purgeRelationshipData } from '@features/friends/utils/purgeRelationship';
import { deletePersistedMedia, persistedMediaExists } from './persistMedia';
import { registerHandler } from './outboxRunner';
import {
  JOB,
  type MemoryUploadJob,
  type SnapSendJob,
  type StoryPostJob,
  type MessageSendJob,
  type MessageMutationJob,
  type SystemMessageJob,
  type ConversationTouchJob,
  type FriendRequestJob,
  type FriendAcceptJob,
  type FriendIdJob,
  type FriendRemoveJob,
  type FriendBlockJob,
  type StoryViewJob,
} from './jobs';

let initialized = false;

export function initOfflineHandlers(): void {
  if (initialized) return;
  initialized = true;

  registerHandler(JOB.MEMORY_UPLOAD, memoryUpload as never);
  registerHandler(JOB.SNAP_SEND, snapSend as never);
  registerHandler(JOB.STORY_POST, storyPost as never);
  registerHandler(JOB.MESSAGE_SEND, messageSend as never);
  registerHandler(JOB.MESSAGE_VIEW, messageMutation as never);
  registerHandler(JOB.MESSAGE_SAVE, messageMutation as never);
  registerHandler(JOB.MESSAGE_DELETE, messageMutation as never);
  registerHandler(JOB.SYSTEM_MESSAGE, systemMessage as never);
  registerHandler(JOB.CONVERSATION_TOUCH, conversationTouch as never);
  registerHandler(JOB.FRIEND_REQUEST, friendRequest as never);
  registerHandler(JOB.FRIEND_ACCEPT, friendAccept as never);
  registerHandler(JOB.FRIEND_DECLINE, friendDecline as never);
  registerHandler(JOB.FRIEND_REMOVE, friendRemove as never);
  registerHandler(JOB.FRIEND_BLOCK, friendBlock as never);
  registerHandler(JOB.STORY_VIEW, storyView as never);
}

async function memoryUpload(p: MemoryUploadJob): Promise<void> {
  const memory = await database
    .get<Memory>('memories')
    .find(p.memoryId)
    .catch(() => null);
  if (!memory) return;
  if (memory.remoteId) return;

  const localPath = memory.localPath;
  if (!localPath) {
    await database.write(async () => {
      await memory.update((m) => {
        m.uploadStatus = 'failed';
      });
    });
    throw new Error('Memory has no local file');
  }

  const exists = await persistedMediaExists(localPath);
  if (!exists) {
    await database.write(async () => {
      await memory.update((m) => {
        m.uploadStatus = 'failed';
      });
    });
    throw new Error('Local memory file missing');
  }

  await database.write(async () => {
    await memory.update((m) => {
      m.uploadStatus = 'uploading';
    });
  });

  const processed = await processImage(localPath);
  const fullPath = `${p.userId}/${memory.id}_full.jpg`;
  const thumbPath = `${p.userId}/${memory.id}_thumb.jpg`;

  await Promise.all([
    uploadToStorage('memories', fullPath, processed.full.uri, { upsert: true }),
    uploadToStorage('memories', thumbPath, processed.thumbnail.uri, { upsert: true }),
  ]);

  const { data, error } = await supabase
    .from('memories')
    .insert({
      user_id: p.userId,
      media_url: fullPath,
      thumbnail_url: thumbPath,
      source: p.source,
    })
    .select()
    .single();
  if (error) throw error;

  await database.write(async () => {
    await memory.update((m) => {
      m.remoteId = data?.id ?? null;
      m.mediaUrl = fullPath;
      m.thumbnailUrl = thumbPath;
      m.uploadStatus = 'done';
      m.localPath = null;
    });
  });

  await deletePersistedMedia(localPath);
}

async function snapSend(p: SnapSendJob): Promise<void> {
  const fullExists = await persistedMediaExists(p.imageUri);
  if (!fullExists) throw new Error('Snap source file missing');

  const processed = await processImage(p.imageUri);
  await Promise.all([
    uploadToStorage('snaps', p.fullPath, processed.full.uri, { upsert: true }),
    uploadToStorage('snaps', p.thumbPath, processed.thumbnail.uri, { upsert: true }),
  ]);

  if (p.recipientIds.length > 0) {
    const snapRows = p.recipientIds.map((rid) => ({
      id: p.snapIds[rid],
      sender_id: p.senderId,
      recipient_id: rid,
      media_url: p.fullPath,
    }));
    const { error: snapsErr } = await supabase
      .from('snaps')
      .upsert(snapRows, { onConflict: 'id', ignoreDuplicates: true });
    if (snapsErr) throw snapsErr;

    await Promise.all(
      p.recipientIds.map((rid) => recordSnapSent(p.senderId, rid).catch(() => null))
    );

    for (const rid of p.recipientIds) {
      const convId = await ensureConversation(p.senderId, rid);
      if (!convId) continue;

      const { data: existingSys } = await supabase
        .from('messages')
        .select('id')
        .eq('id', p.systemMessageIds[rid])
        .maybeSingle();

      if (!existingSys) {
        const { count: otherSnapCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', convId)
          .eq('type', 'snap')
          .neq('id', p.snapMessageIds[rid]);

        if ((otherSnapCount ?? 0) === 0) {
          await supabase.from('messages').upsert(
            {
              id: p.systemMessageIds[rid],
              conversation_id: convId,
              sender_id: p.senderId,
              content: '🔥 Streak started!',
              type: 'system',
            },
            { onConflict: 'id', ignoreDuplicates: true }
          );
        }
      }

      await supabase.from('messages').upsert(
        {
          id: p.snapMessageIds[rid],
          conversation_id: convId,
          sender_id: p.senderId,
          media_url: p.fullPath,
          type: 'snap',
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', convId);
    }
  }

  if (p.postToMyStory && p.storyPath && p.storyId) {
    await uploadToStorage('stories', p.storyPath, processed.full.uri, {
      upsert: true,
    });
    await supabase.from('stories').upsert(
      {
        id: p.storyId,
        user_id: p.senderId,
        media_url: p.storyPath,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );
  }

  await deletePersistedMedia(p.imageUri);
}

async function storyPost(p: StoryPostJob): Promise<void> {
  const exists = await persistedMediaExists(p.imageUri);
  if (!exists) throw new Error('Story source file missing');

  await uploadToStorage('stories', p.storagePath, p.imageUri, { upsert: true });
  const { error } = await supabase.from('stories').upsert(
    {
      id: p.storyId,
      user_id: p.userId,
      media_url: p.storagePath,
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );
  if (error) throw error;

  await deletePersistedMedia(p.imageUri);
}

async function messageSend(p: MessageSendJob): Promise<void> {
  const local = await database
    .get<Message>('messages')
    .find(p.messageId)
    .catch(() => null);
  if (local && local.remoteId) return;

  const payload: Record<string, unknown> = {
    id: p.messageId,
    conversation_id: p.conversationId,
    sender_id: p.senderId,
    content: p.content,
    type: p.type,
  };
  if (p.replyToMessageId) payload.reply_to_message_id = p.replyToMessageId;

  const { error } = await supabase
    .from('messages')
    .upsert(payload, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;

  if (local) {
    await database.write(async () => {
      await local.update((m) => {
        m.remoteId = p.messageId;
        m.isOptimistic = false;
      });
    });
  }
}

async function messageMutation(p: MessageMutationJob): Promise<void> {
  const updates: Record<string, unknown> = {};
  updates[p.field] = p.value;
  const { error } = await supabase.from('messages').update(updates).eq('id', p.messageId);
  if (error) throw error;
}

async function systemMessage(p: SystemMessageJob): Promise<void> {
  const { error } = await supabase.from('messages').upsert(
    {
      id: p.messageId,
      conversation_id: p.conversationId,
      sender_id: p.senderId,
      content: p.content,
      type: 'system',
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );
  if (error) throw error;
}

async function conversationTouch(p: ConversationTouchJob): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', p.conversationId);
  if (error) throw error;
}

async function friendRequest(p: FriendRequestJob): Promise<void> {
  await supabase
    .from('friendships')
    .delete()
    .or(
      `and(requester_id.eq.${p.requesterId},addressee_id.eq.${p.addresseeId}),` +
        `and(requester_id.eq.${p.addresseeId},addressee_id.eq.${p.requesterId})`
    )
    .not('status', 'in', '(accepted,pending)');

  const { error } = await supabase.from('friendships').upsert(
    {
      id: p.friendshipId,
      requester_id: p.requesterId,
      addressee_id: p.addresseeId,
      status: 'pending',
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );
  if (error) throw error;
}

async function friendAccept(p: FriendAcceptJob): Promise<void> {
  const { data, error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', p.friendshipId)
    .select()
    .maybeSingle();
  if (error) throw error;

  if (data) {
    const [p1, p2] = [p.myId, p.otherId].sort();
    await supabase
      .from('conversations')
      .upsert(
        { participant_1: p1, participant_2: p2 },
        { onConflict: 'participant_1,participant_2', ignoreDuplicates: true }
      );
  }

  const local = await database
    .get<Friend>('friends')
    .query(Q.where('remote_id', p.friendshipId))
    .fetch();
  if (local.length > 0) {
    await database.write(async () => {
      await local[0].update((f) => {
        f.status = 'accepted';
      });
    });
  }
}

async function friendDecline(p: FriendIdJob): Promise<void> {
  const { error } = await supabase.from('friendships').delete().eq('id', p.friendshipId);
  if (error) throw error;
}

async function friendRemove(p: FriendRemoveJob): Promise<void> {
  await supabase.from('friendships').delete().eq('id', p.friendshipId);
  await purgeRelationshipData(p.myId, p.otherUserId);
}

async function friendBlock(p: FriendBlockJob): Promise<void> {
  await supabase
    .from('friendships')
    .delete()
    .or(
      `and(requester_id.eq.${p.myId},addressee_id.eq.${p.blockedId}),` +
        `and(requester_id.eq.${p.blockedId},addressee_id.eq.${p.myId})`
    );
  await supabase
    .from('blocks')
    .upsert(
      { blocker_id: p.myId, blocked_id: p.blockedId },
      { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true }
    );
  await purgeRelationshipData(p.myId, p.blockedId);
}

async function storyView(p: StoryViewJob): Promise<void> {
  const { error } = await supabase.from('story_views').upsert(
    {
      story_id: p.storyId,
      viewer_id: p.viewerId,
    },
    { onConflict: 'story_id,viewer_id', ignoreDuplicates: true }
  );
  if (error) throw error;
}
