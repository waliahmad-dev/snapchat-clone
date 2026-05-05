import { Q } from '@nozbe/watermelondb';
import { database } from '@lib/watermelondb/database';
import GroupChat from '@lib/watermelondb/models/GroupChat';
import GroupMember from '@lib/watermelondb/models/GroupMember';
import GroupMessage from '@lib/watermelondb/models/GroupMessage';
import GroupMessageView from '@lib/watermelondb/models/GroupMessageView';
import { enqueueJob } from '@lib/offline/outboxRunner';
import { JOB } from '@lib/offline/jobs';
import { uuid } from '@lib/offline/uuid';
import i18n from '@lib/i18n';

export async function renameGroup(groupId: string, name: string | null): Promise<void> {
  const cleaned = name?.trim() || null;
  const rows = await database
    .get<GroupChat>('group_chats')
    .query(Q.where('remote_id', groupId))
    .fetch();
  if (rows.length > 0) {
    await database.write(async () => {
      await rows[0].update((g) => {
        g.name = cleaned;
        g.updatedAt = Date.now();
      });
    });
  }
  await enqueueJob({
    kind: JOB.GROUP_UPDATE,
    payload: { groupId, name: cleaned },
    groupKey: `group-update:${groupId}`,
  });
}

export async function addMembersToGroup(
  groupId: string,
  myId: string,
  myName: string,
  newMemberIds: string[],
  newMemberNames: Record<string, string>
): Promise<void> {
  if (newMemberIds.length === 0) return;
  const now = Date.now();

  const memberships: { userId: string; membershipId: string }[] = [];

  // For each user: revive an existing (potentially left-at-set) row in
  // place when one exists; otherwise create a fresh optimistic row.
  // Avoids duplicate local rows that desync from the server's revived id.
  for (const userId of newMemberIds) {
    const existing = await database
      .get<GroupMember>('group_members')
      .query(Q.where('group_id', groupId), Q.where('user_id', userId))
      .fetch();

    if (existing.length > 0) {
      const row = existing[0];
      const membershipId = row.remoteId;
      await database.write(async () => {
        await row.update((m) => {
          m.leftAt = null;
          m.joinedAt = now;
        });
      });
      memberships.push({ userId, membershipId });
    } else {
      const membershipId = uuid();
      await database.write(async () => {
        await database.get<GroupMember>('group_members').create((m) => {
          m.remoteId = membershipId;
          m.groupId = groupId;
          m.userId = userId;
          m.notifications = 'all';
          m.joinedAt = now;
          m.leftAt = null;
        });
      });
      memberships.push({ userId, membershipId });
    }
  }

  for (const { userId, membershipId } of memberships) {
    await enqueueJob({
      kind: JOB.GROUP_MEMBER_ADD,
      payload: { membershipId, groupId, userId },
      groupKey: `group-add:${membershipId}`,
    });

    const sysContent = i18n.t('chat.group.system.addedMember', {
      name: myName,
      member: newMemberNames[userId] ?? i18n.t('common.someone'),
    });
    const sysId = uuid();
    await database.write(async () => {
      await database.get<GroupMessage>('group_messages').create((m) => {
        m.remoteId = sysId;
        m.groupId = groupId;
        m.senderId = myId;
        m.content = sysContent;
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
      payload: { messageId: sysId, groupId, senderId: myId, content: sysContent },
      groupKey: `group-sysmsg:${sysId}`,
    });
  }
}

export async function leaveGroup(
  groupId: string,
  myId: string,
  myName: string,
  membershipId: string
): Promise<void> {
  const sysContent = i18n.t('chat.group.system.leftGroup', { name: myName });
  const sysId = uuid();

  // Post system event first so other members see it.
  await database.write(async () => {
    await database.get<GroupMessage>('group_messages').create((m) => {
      m.remoteId = sysId;
      m.groupId = groupId;
      m.senderId = myId;
      m.content = sysContent;
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
    payload: { messageId: sysId, groupId, senderId: myId, content: sysContent },
    groupKey: `group-sysmsg:${sysId}`,
  });

  // Locally drop my membership + the group itself, AND every cached
  // message / view for this group, so a future re-join won't surface the
  // pre-leave history.
  const memberRows = await database
    .get<GroupMember>('group_members')
    .query(Q.where('group_id', groupId), Q.where('user_id', myId))
    .fetch();
  const groupRows = await database
    .get<GroupChat>('group_chats')
    .query(Q.where('remote_id', groupId))
    .fetch();
  const messageRows = await database
    .get<GroupMessage>('group_messages')
    .query(Q.where('group_id', groupId))
    .fetch();
  const messageIds = new Set(messageRows.map((m) => m.remoteId));
  const viewRows =
    messageIds.size > 0
      ? await database
          .get<GroupMessageView>('group_message_views')
          .query(Q.where('message_id', Q.oneOf([...messageIds])))
          .fetch()
      : [];
  await database.write(async () => {
    for (const r of memberRows) await r.destroyPermanently();
    for (const r of groupRows) await r.destroyPermanently();
    for (const r of messageRows) await r.destroyPermanently();
    for (const r of viewRows) await r.destroyPermanently();
  });

  await enqueueJob({
    kind: JOB.GROUP_MEMBER_LEAVE,
    payload: { membershipId, groupId, userId: myId },
    groupKey: `group-leave:${membershipId}`,
  });
}
