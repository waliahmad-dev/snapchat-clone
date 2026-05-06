import { Q } from '@nozbe/watermelondb';
import { supabase } from '@lib/supabase/client';
import { uploadToStorage } from '@lib/supabase/storage';
import { processImage } from '@lib/imageManipulator/processor';
import { recordSnapSent } from '@lib/redis/streak';
import { database } from '@lib/watermelondb/database';
import Memory from '@lib/watermelondb/models/Memory';
import Message from '@lib/watermelondb/models/Message';
import Friend from '@lib/watermelondb/models/Friend';
import GroupChat from '@lib/watermelondb/models/GroupChat';
import GroupMember from '@lib/watermelondb/models/GroupMember';
import GroupMessage from '@lib/watermelondb/models/GroupMessage';
import GroupMessageView from '@lib/watermelondb/models/GroupMessageView';
import { ensureConversation } from '@features/chat/utils/conversation';
import { purgeRelationshipData } from '@features/friends/utils/purgeRelationship';
import { useStoriesStore } from '@features/stories/store/storiesStore';
import { deletePersistedMedia, persistedMediaExists } from './persistMedia';
import { registerHandler } from './outboxRunner';
import {
  JOB,
  type MemoryUploadJob,
  type SnapSendJob,
  type StoryPostJob,
  type MessageSendJob,
  type MessageMutationJob,
  type MessageSaveJob,
  type SystemMessageJob,
  type ConversationTouchJob,
  type ChatPresenceSetJob,
  type FriendRequestJob,
  type FriendAcceptJob,
  type FriendIdJob,
  type FriendRemoveJob,
  type FriendBlockJob,
  type StoryViewJob,
  type GroupCreateJob,
  type GroupUpdateJob,
  type GroupMessageSendJob,
  type GroupMessageViewJob,
  type GroupMessageSaveJob,
  type GroupMessageDeleteJob,
  type GroupSystemMessageJob,
  type GroupMemberAddJob,
  type GroupMemberLeaveJob,
  type GroupNotificationsSetJob,
  type GroupScreenshotJob,
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
  registerHandler(JOB.MESSAGE_SAVE, messageSave as never);
  registerHandler(JOB.MESSAGE_DELETE, messageMutation as never);
  registerHandler(JOB.SYSTEM_MESSAGE, systemMessage as never);
  registerHandler(JOB.CONVERSATION_TOUCH, conversationTouch as never);
  registerHandler(JOB.CHAT_PRESENCE_SET, chatPresenceSet as never);
  registerHandler(JOB.FRIEND_REQUEST, friendRequest as never);
  registerHandler(JOB.FRIEND_ACCEPT, friendAccept as never);
  registerHandler(JOB.FRIEND_DECLINE, friendDecline as never);
  registerHandler(JOB.FRIEND_REMOVE, friendRemove as never);
  registerHandler(JOB.FRIEND_BLOCK, friendBlock as never);
  registerHandler(JOB.STORY_VIEW, storyView as never);
  registerHandler(JOB.GROUP_CREATE, groupCreate as never);
  registerHandler(JOB.GROUP_UPDATE, groupUpdate as never);
  registerHandler(JOB.GROUP_MESSAGE_SEND, groupMessageSend as never);
  registerHandler(JOB.GROUP_MESSAGE_VIEW, groupMessageView as never);
  registerHandler(JOB.GROUP_MESSAGE_SAVE, groupMessageSave as never);
  registerHandler(JOB.GROUP_MESSAGE_DELETE, groupMessageDelete as never);
  registerHandler(JOB.GROUP_SYSTEM_MESSAGE, groupSystemMessage as never);
  registerHandler(JOB.GROUP_MEMBER_ADD, groupMemberAdd as never);
  registerHandler(JOB.GROUP_MEMBER_LEAVE, groupMemberLeave as never);
  registerHandler(JOB.GROUP_NOTIFICATIONS_SET, groupNotificationsSet as never);
  registerHandler(JOB.GROUP_SCREENSHOT, groupScreenshot as never);
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
    useStoriesStore.getState().notifyPosted();
  }

  if (p.groupIds && p.groupIds.length > 0 && p.groupMessageIds) {
    for (const gid of p.groupIds) {
      const messageId = p.groupMessageIds[gid];
      if (!messageId) continue;

      const { error: gmErr } = await supabase.from('group_messages').upsert(
        {
          id: messageId,
          group_id: gid,
          sender_id: p.senderId,
          media_url: p.fullPath,
          type: 'media',
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );
      if (gmErr) throw gmErr;

      await supabase
        .from('group_chats')
        .update({
          last_message_text: '📷 Snap',
          last_message_at: new Date().toISOString(),
        })
        .eq('id', gid);
    }
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

  useStoriesStore.getState().notifyPosted();
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

async function messageSave(p: MessageSaveJob): Promise<void> {
  const { error } = await supabase.rpc('toggle_message_save', {
    _message: p.messageId,
    _save: p.save,
  });
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

async function chatPresenceSet(p: ChatPresenceSetJob): Promise<void> {
  const { error } = await supabase.rpc('set_chat_presence', {
    _conversation: p.conversationId,
    _in_chat: p.inChat,
  });
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

async function groupCreate(p: GroupCreateJob): Promise<void> {
  const { error: gErr } = await supabase.from('group_chats').upsert(
    {
      id: p.groupId,
      name: p.name,
      created_by: p.createdBy,
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );
  if (gErr) throw gErr;

  const { error: meErr } = await supabase.from('group_members').upsert(
    {
      id: p.createdByMembershipId,
      group_id: p.groupId,
      user_id: p.createdBy,
    },
    { onConflict: 'group_id,user_id', ignoreDuplicates: true }
  );
  if (meErr) throw meErr;

  if (p.memberIds.length > 0) {
    const otherRows = p.memberIds.map((uid) => ({
      id: p.memberMembershipIds[uid],
      group_id: p.groupId,
      user_id: uid,
    }));
    const { error: othersErr } = await supabase
      .from('group_members')
      .upsert(otherRows, { onConflict: 'group_id,user_id', ignoreDuplicates: true });
    if (othersErr) throw othersErr;
  }
}

async function groupUpdate(p: GroupUpdateJob): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (p.name !== undefined) updates.name = p.name;
  if (p.avatarUrl !== undefined) updates.avatar_url = p.avatarUrl;
  if (Object.keys(updates).length === 0) return;
  const { error } = await supabase.from('group_chats').update(updates).eq('id', p.groupId);
  if (error) throw error;
}

async function groupMessageSend(p: GroupMessageSendJob): Promise<void> {
  const local = await database
    .get<GroupMessage>('group_messages')
    .find(p.messageId)
    .catch(() => null);
  if (local && local.remoteId && !local.isOptimistic) return;

  const payload: Record<string, unknown> = {
    id: p.messageId,
    group_id: p.groupId,
    sender_id: p.senderId,
    content: p.content,
    media_url: p.mediaUrl,
    type: p.type,
    mentions: p.mentions,
  };
  if (p.replyToMessageId) payload.reply_to_message_id = p.replyToMessageId;

  const { error } = await supabase
    .from('group_messages')
    .upsert(payload, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;

  const preview = p.type === 'media' ? '📷 Snap' : (p.content ?? '').slice(0, 80);
  await supabase
    .from('group_chats')
    .update({
      last_message_text: preview,
      last_message_at: new Date().toISOString(),
    })
    .eq('id', p.groupId);

  if (local) {
    await database.write(async () => {
      await local.update((m) => {
        m.remoteId = p.messageId;
        m.isOptimistic = false;
      });
    });
  }
}

async function groupMessageView(p: GroupMessageViewJob): Promise<void> {
  const { error } = await supabase.from('group_message_views').upsert(
    {
      message_id: p.messageId,
      user_id: p.userId,
    },
    { onConflict: 'message_id,user_id', ignoreDuplicates: true }
  );
  if (error) throw error;
}

async function groupMessageSave(p: GroupMessageSaveJob): Promise<void> {
  const { error } = await supabase.rpc('toggle_group_message_save', {
    _message: p.messageId,
    _save: p.save,
  });
  if (error) throw error;
}

async function groupMessageDelete(p: GroupMessageDeleteJob): Promise<void> {
  const { error } = await supabase
    .from('group_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', p.messageId);
  if (error) throw error;
}

async function groupSystemMessage(p: GroupSystemMessageJob): Promise<void> {
  const { error } = await supabase.from('group_messages').upsert(
    {
      id: p.messageId,
      group_id: p.groupId,
      sender_id: p.senderId,
      content: p.content,
      type: 'system',
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );
  if (error) throw error;
}

async function groupMemberAdd(p: GroupMemberAddJob): Promise<void> {
  // The RPC handles both "fresh insert" and "user previously left, clear
  // their left_at" cases atomically. Direct upsert can't because the UNIQUE
  // (group_id, user_id) constraint silently skips with ignoreDuplicates,
  // and a plain UPDATE is denied by RLS for the calling user.
  const { error } = await supabase.rpc('rejoin_group_member', {
    _group: p.groupId,
    _user: p.userId,
  });
  if (error) throw error;
}

async function groupMemberLeave(p: GroupMemberLeaveJob): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .update({ left_at: new Date().toISOString() })
    .eq('id', p.membershipId);
  if (error) throw error;

  // Local: drop the group, my membership, every cached message for this
  // group, and the message-view rows. If I'm ever re-added, syncFromServer
  // will pull back only the messages newer than my new joined_at.
  const localMembers = await database
    .get<GroupMember>('group_members')
    .query(Q.where('group_id', p.groupId), Q.where('user_id', p.userId))
    .fetch();
  const localGroups = await database
    .get<GroupChat>('group_chats')
    .query(Q.where('remote_id', p.groupId))
    .fetch();
  const localMessages = await database
    .get<GroupMessage>('group_messages')
    .query(Q.where('group_id', p.groupId))
    .fetch();
  const messageIds = new Set(localMessages.map((m) => m.remoteId));
  const localViews =
    messageIds.size > 0
      ? await database
          .get<GroupMessageView>('group_message_views')
          .query(Q.where('message_id', Q.oneOf([...messageIds])))
          .fetch()
      : [];

  if (
    localMembers.length === 0 &&
    localGroups.length === 0 &&
    localMessages.length === 0 &&
    localViews.length === 0
  ) {
    return;
  }
  await database.write(async () => {
    for (const m of localMembers) await m.destroyPermanently();
    for (const g of localGroups) await g.destroyPermanently();
    for (const m of localMessages) await m.destroyPermanently();
    for (const v of localViews) await v.destroyPermanently();
  });
}

async function groupNotificationsSet(p: GroupNotificationsSetJob): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .update({ notifications: p.setting })
    .eq('id', p.membershipId);
  if (error) throw error;
}

async function groupScreenshot(p: GroupScreenshotJob): Promise<void> {
  const { error: viewErr } = await supabase.from('group_message_views').upsert(
    {
      message_id: p.messageId,
      user_id: p.userId,
      screenshot_at: new Date().toISOString(),
    },
    { onConflict: 'message_id,user_id', ignoreDuplicates: false }
  );
  if (viewErr) throw viewErr;
}
