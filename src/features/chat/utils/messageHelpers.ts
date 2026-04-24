import type { DbMessage, MessageType } from '@/types/database';

export function formatMessagePreview(message: DbMessage | null): string {
  if (!message) return '';
  if (message.deleted_at) return 'Message deleted';

  switch (message.type as MessageType) {
    case 'snap':
      return '📷 Snap';
    case 'media':
      return '🖼 Photo';
    case 'system':
      return message.content ?? 'System event';
    case 'text':
    default:
      return message.content ?? '';
  }
}

export function isEphemeral(message: DbMessage): boolean {
  return message.type === 'snap' && !message.saved;
}

export function shouldAutoDelete(message: DbMessage): boolean {
  return (
    message.type === 'snap' &&
    !message.saved &&
    message.viewed_at !== null &&
    message.deleted_at === null
  );
}

export function relativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}


export function shortTimeAgo(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const then = new Date(isoString).getTime();
  if (!Number.isFinite(then)) return '';
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return 'now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return `${Math.floor(diffDay / 7)}w`;
}
