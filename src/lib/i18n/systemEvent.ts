export interface SystemEventPayload {
  '@i18n': 1;
  key: string;
  args?: Record<string, string>;
}

const SENTINEL_PREFIX = '{"@i18n"';

export function encodeSystemEvent(key: string, args: Record<string, string> = {}): string {
  const payload: SystemEventPayload = { '@i18n': 1, key, args };
  return JSON.stringify(payload);
}

export function decodeSystemEvent(content: string | null | undefined): SystemEventPayload | null {
  if (!content || !content.startsWith(SENTINEL_PREFIX)) return null;
  try {
    const parsed = JSON.parse(content) as SystemEventPayload;
    if (parsed && parsed['@i18n'] === 1 && typeof parsed.key === 'string') {
      return parsed;
    }
  } catch {}
  return null;
}
