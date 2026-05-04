import { useEffect } from 'react';
import * as ScreenCapture from 'expo-screen-capture';
import { database } from '@lib/watermelondb/database';
import GroupMessage from '@lib/watermelondb/models/GroupMessage';
import { useAuthStore } from '@features/auth/store/authStore';
import { enqueueJob } from '@lib/offline/outboxRunner';
import { JOB } from '@lib/offline/jobs';
import { uuid } from '@lib/offline/uuid';

export function useGroupScreenshotDetection(groupId: string) {
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    if (!groupId || !profile) return;

    const subscription = ScreenCapture.addScreenshotListener(async () => {
      const messageId = uuid();
      const content = `${profile.display_name} took a screenshot 📸`;

      await database.write(async () => {
        await database.get<GroupMessage>('group_messages').create((m) => {
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
    });

    return () => subscription.remove();
  }, [groupId, profile?.id]);
}
