import { router } from 'expo-router';
import { database } from '@lib/watermelondb/database';
import GroupChat from '@lib/watermelondb/models/GroupChat';
import GroupMember from '@lib/watermelondb/models/GroupMember';
import GroupMessage from '@lib/watermelondb/models/GroupMessage';
import { enqueueJob } from '@lib/offline/outboxRunner';
import { JOB } from '@lib/offline/jobs';
import { uuid } from '@lib/offline/uuid';

export interface CreateGroupInput {
  creatorId: string;
  creatorName: string;
  memberIds: string[];
  name: string | null;
}

/**
 * Optimistically materialise a new group chat locally and enqueue the
 * server-side create. Returns the new group's id so the caller can
 * navigate straight into the thread.
 */
export async function createGroup(input: CreateGroupInput): Promise<string> {
  const groupId = uuid();
  const now = Date.now();
  const cleanedName = input.name?.trim() || null;

  const creatorMembershipId = uuid();
  const memberMembershipIds: Record<string, string> = {};
  for (const uid of input.memberIds) memberMembershipIds[uid] = uuid();

  const systemMessageId = uuid();
  const systemContent = `${input.creatorName} created the group`;

  await database.write(async () => {
    await database.get<GroupChat>('group_chats').create((g) => {
      g.remoteId = groupId;
      g.name = cleanedName;
      g.avatarUrl = null;
      g.createdBy = input.creatorId;
      g.lastMessageText = systemContent;
      g.lastMessageAt = now;
      g.createdAt = now;
      g.updatedAt = now;
      g.syncedAt = null;
      g.deletedAt = null;
    });

    await database.get<GroupMember>('group_members').create((m) => {
      m.remoteId = creatorMembershipId;
      m.groupId = groupId;
      m.userId = input.creatorId;
      m.notifications = 'all';
      m.joinedAt = now;
      m.leftAt = null;
    });

    for (const uid of input.memberIds) {
      await database.get<GroupMember>('group_members').create((m) => {
        m.remoteId = memberMembershipIds[uid];
        m.groupId = groupId;
        m.userId = uid;
        m.notifications = 'all';
        m.joinedAt = now;
        m.leftAt = null;
      });
    }

    await database.get<GroupMessage>('group_messages').create((m) => {
      m.remoteId = systemMessageId;
      m.groupId = groupId;
      m.senderId = input.creatorId;
      m.content = systemContent;
      m.mediaUrl = null;
      m.type = 'system';
      m.mentionsJson = '[]';
      m.savedByJson = '[]';
      m.replyToMessageId = null;
      m.createdAt = now;
      m.deletedAt = null;
      m.isOptimistic = true;
    });
  });

  await enqueueJob({
    kind: JOB.GROUP_CREATE,
    payload: {
      groupId,
      name: cleanedName,
      createdBy: input.creatorId,
      memberIds: input.memberIds,
      createdByMembershipId: creatorMembershipId,
      memberMembershipIds,
    },
    groupKey: `group-create:${groupId}`,
  });

  await enqueueJob({
    kind: JOB.GROUP_SYSTEM_MESSAGE,
    payload: {
      messageId: systemMessageId,
      groupId,
      senderId: input.creatorId,
      content: systemContent,
    },
    groupKey: `group-sysmsg:${systemMessageId}`,
  });

  return groupId;
}

export function openGroupChat(groupId: string, name?: string | null): void {
  router.push({
    pathname: '/(app)/chat/group/[groupId]',
    params: { groupId, ...(name ? { name } : {}) },
  });
}
