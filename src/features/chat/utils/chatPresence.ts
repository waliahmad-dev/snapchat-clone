import { enqueueLatestJob } from '@lib/offline/outboxRunner';
import { JOB } from '@lib/offline/jobs';

/**
 * Mark the current user as in/out of a 1:1 chat. The server-side trigger on
 * chat_presence soft-deletes unsaved messages once both participants are out,
 * so cleanup never races a still-present participant.
 *
 * Coalesced via the outbox: rapid flips (e.g. AppState blips while opening
 * a system alert) collapse to the latest intent rather than firing spurious
 * leave events.
 */
export function setChatPresence(conversationId: string, userId: string, inChat: boolean): void {
  void enqueueLatestJob({
    kind: JOB.CHAT_PRESENCE_SET,
    payload: { conversationId, inChat },
    groupKey: `presence:${conversationId}:${userId}`,
  });
}
