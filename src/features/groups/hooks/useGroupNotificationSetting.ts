import { useCallback } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '@lib/watermelondb/database';
import GroupMember from '@lib/watermelondb/models/GroupMember';
import { enqueueJob } from '@lib/offline/outboxRunner';
import { JOB } from '@lib/offline/jobs';
import type { GroupNotificationsSetting } from '@/types/database';

export function useGroupNotificationSetting(membershipId: string | undefined) {
  return useCallback(
    async (setting: GroupNotificationsSetting) => {
      if (!membershipId) return;
      const rows = await database
        .get<GroupMember>('group_members')
        .query(Q.where('remote_id', membershipId))
        .fetch();
      if (rows.length > 0) {
        await database.write(async () => {
          await rows[0].update((m) => {
            m.notifications = setting;
          });
        });
      }
      await enqueueJob({
        kind: JOB.GROUP_NOTIFICATIONS_SET,
        payload: { membershipId, setting },
        groupKey: `group-notif:${membershipId}`,
      });
    },
    [membershipId]
  );
}
