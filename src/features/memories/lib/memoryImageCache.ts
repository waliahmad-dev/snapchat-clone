import { getSignedUrl } from '@lib/supabase/storage';
import { SIGNED_URL_EXPIRY_SECONDS } from '@constants/config';
import type Memory from '@lib/watermelondb/models/Memory';

const TTL_MS = Math.max((SIGNED_URL_EXPIRY_SECONDS - 60) * 1000, 60_000);

interface Entry {
  url: string;
  expiresAt: number;
}

const thumbUrls = new Map<string, Entry>();
const fullUrls = new Map<string, Entry>();

function read(map: Map<string, Entry>, key: string): string | null {
  const e = map.get(key);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    map.delete(key);
    return null;
  }
  return e.url;
}

function write(map: Map<string, Entry>, key: string, url: string): void {
  map.set(key, { url, expiresAt: Date.now() + TTL_MS });
}

export function thumbCacheKey(memory: Memory): string {
  return `mem-thumb-${memory.id}`;
}

export function fullCacheKey(memory: Memory): string {
  return `mem-full-${memory.id}`;
}

export async function resolveThumbUrl(memory: Memory): Promise<string> {
  if (memory.localPath) return memory.localPath;
  const cached = read(thumbUrls, memory.id);
  if (cached) return cached;
  const path = memory.thumbnailUrl || memory.mediaUrl;
  const url = await getSignedUrl('memories', path);
  write(thumbUrls, memory.id, url);
  return url;
}

export async function resolveFullUrl(memory: Memory): Promise<string> {
  if (memory.localPath) return memory.localPath;
  const cached = read(fullUrls, memory.id);
  if (cached) return cached;
  const url = await getSignedUrl('memories', memory.mediaUrl);
  write(fullUrls, memory.id, url);
  return url;
}

export function invalidateMemory(memoryId: string): void {
  thumbUrls.delete(memoryId);
  fullUrls.delete(memoryId);
}

export async function warmThumbs(memories: Memory[]): Promise<void> {
  await Promise.all(
    memories.map((m) => resolveThumbUrl(m).catch(() => null)),
  );
}

export async function warmFullsAround(
  memories: Memory[],
  index: number,
  radius = 1,
): Promise<void> {
  const targets: Memory[] = [];
  for (let i = index - radius; i <= index + radius; i++) {
    if (i >= 0 && i < memories.length && i !== index) {
      targets.push(memories[i]);
    }
  }
  await Promise.all(
    targets.map((m) => resolveFullUrl(m).catch(() => null)),
  );
}
