import { useEffect } from 'react';
import * as ScreenCapture from 'expo-screen-capture';
import { database } from '@lib/watermelondb/database';
import Message from '@lib/watermelondb/models/Message';
import { useAuthStore } from '@features/auth/store/authStore';
import { enqueueJob } from '@lib/offline/outboxRunner';
import { JOB } from '@lib/offline/jobs';
import { uuid } from '@lib/offline/uuid';
import { encodeSystemEvent } from '@lib/i18n/systemEvent';

export function useScreenshotDetection(conversationId: string) {
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    if (!conversationId || !profile) return;

    const subscription = ScreenCapture.addScreenshotListener(async () => {
      const messageId = uuid();
      const content = encodeSystemEvent('chat.screenshotTaken', {
        name: profile.display_name,
      });

      await database.write(async () => {
        await database.get<Message>('messages').create((m) => {
          m.remoteId = messageId;
          m.conversationId = conversationId;
          m.senderId = profile.id;
          m.content = content;
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
          messageId,
          conversationId,
          senderId: profile.id,
          content,
        },
        groupKey: `sysmsg:${messageId}`,
      });
    });

    return () => subscription.remove();
  }, [conversationId, profile?.id]);
}
