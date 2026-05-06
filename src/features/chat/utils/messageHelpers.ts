import i18n from '@lib/i18n';
import type { DbMessage, MessageType } from '@/types/database';
import { decodeSystemEvent } from '@lib/i18n/systemEvent';

export function formatMessagePreview(message: DbMessage | null): string {
  if (!message) return '';
  if (message.deleted_at) return i18n.t('chat.preview.deleted');

  switch (message.type as MessageType) {
    case 'snap':
      return i18n.t('chat.preview.snap');
    case 'media':
      return i18n.t('chat.preview.photo');
    case 'system': {
      // System messages are stored as i18n-event envelopes so each reader
      // can render them in their own locale.
      const evt = decodeSystemEvent(message.content);
      if (evt) return i18n.t(evt.key, evt.args ?? {});
      return message.content ?? i18n.t('chat.preview.systemEvent');
    }
    case 'text':
    default:
      return message.content ?? '';
  }
}

export function isEphemeral(message: DbMessage): boolean {
  return message.type === 'snap' && message.saved_by.length === 0;
}

export function shouldAutoDelete(message: DbMessage): boolean {
  return (
    message.type === 'snap' &&
    message.saved_by.length === 0 &&
    message.viewed_at !== null &&
    message.deleted_at === null
  );
}

export function relativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return i18n.t('chat.time.justNow');
  if (diff < 3600) return i18n.t('chat.time.minutesAgo', { count: Math.floor(diff / 60) });
  if (diff < 86400) return i18n.t('chat.time.hoursAgo', { count: Math.floor(diff / 3600) });
  return i18n.t('chat.time.daysAgo', { count: Math.floor(diff / 86400) });
}


export function shortTimeAgo(
  isoString: string | null | undefined,
  now: number = Date.now(),
): string {
  if (!isoString) return '';
  const then = new Date(isoString).getTime();
  if (!Number.isFinite(then)) return '';
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return i18n.t('chat.time.now');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return i18n.t('chat.time.minutes', { count: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return i18n.t('chat.time.hours', { count: diffHr });
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return i18n.t('chat.time.days', { count: diffDay });
  return i18n.t('chat.time.weeks', { count: Math.floor(diffDay / 7) });
}
