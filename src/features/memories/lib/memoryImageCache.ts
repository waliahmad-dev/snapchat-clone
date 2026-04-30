import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { getSignedUrl } from '@lib/supabase/storage';
import { SIGNED_URL_EXPIRY_SECONDS } from '@constants/config';
import type Memory from '@lib/watermelondb/models/Memory';

const TTL_MS = Math.max((SIGNED_URL_EXPIRY_SECONDS - 60) * 1000, 60_000);

const THUMB_DIR = `${FileSystem.documentDirectory}memory-thumbs/`;
const FULL_DIR = `${FileSystem.documentDirectory}memory-full/`;
const PERSIST_TOP_N = 4;

interface Entry {
  url: string;
  expiresAt: number;
}

const thumbUrls = new Map<string, Entry>();
const fullUrls = new Map<string, Entry>();
const persistedThumb = new Map<string, string>();
const persistedFull = new Map<string, string>();

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

function persistedThumbPath(memoryId: string): string {
  return `${THUMB_DIR}${memoryId}.jpg`;
}

function persistedFullPath(memoryId: string): string {
  return `${FULL_DIR}${memoryId}.jpg`;
}

async function readPersisted(
  memoryId: string,
  pathFor: (id: string) => string,
  cache: Map<string, string>,
): Promise<string | null> {
  const cached = cache.get(memoryId);
  if (cached) return cached;
  const path = pathFor(memoryId);
  const info = await FileSystem.getInfoAsync(path).catch(() => null);
  if (info?.exists) {
    cache.set(memoryId, path);
    return path;
  }
  return null;
}

async function tryGalleryUri(memory: Memory): Promise<string | null> {
  if (!memory.galleryAssetId) return null;
  try {
    const info = await MediaLibrary.getAssetInfoAsync(memory.galleryAssetId);
    return info?.localUri || info?.uri || null;
  } catch {
    return null;
  }
}

export async function resolveThumbUrl(memory: Memory): Promise<string> {
  if (memory.localPath) return memory.localPath;
  const gallery = await tryGalleryUri(memory);
  if (gallery) return gallery;
  const persisted = await readPersisted(memory.id, persistedThumbPath, persistedThumb);
  if (persisted) return persisted;
  const cached = read(thumbUrls, memory.id);
  if (cached) return cached;
  const path = memory.thumbnailUrl || memory.mediaUrl;
  if (!path) throw new Error('No source for memory');
  const url = await getSignedUrl('memories', path);
  write(thumbUrls, memory.id, url);
  return url;
}

export async function resolveFullUrl(memory: Memory): Promise<string> {
  if (memory.localPath) return memory.localPath;
  const gallery = await tryGalleryUri(memory);
  if (gallery) return gallery;
  const persisted = await readPersisted(memory.id, persistedFullPath, persistedFull);
  if (persisted) return persisted;
  const cached = read(fullUrls, memory.id);
  if (cached) return cached;
  if (!memory.mediaUrl) throw new Error('No source for memory');
  const url = await getSignedUrl('memories', memory.mediaUrl);
  write(fullUrls, memory.id, url);
  return url;
}

export function invalidateMemory(memoryId: string): void {
  thumbUrls.delete(memoryId);
  fullUrls.delete(memoryId);
  persistedThumb.delete(memoryId);
  persistedFull.delete(memoryId);
  FileSystem.deleteAsync(persistedThumbPath(memoryId), { idempotent: true }).catch(() => {});
  FileSystem.deleteAsync(persistedFullPath(memoryId), { idempotent: true }).catch(() => {});
}

async function ensureDir(dir: string): Promise<void> {
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
}

async function pruneDir(
  dir: string,
  keepIds: Set<string>,
  cache: Map<string, string>,
): Promise<void> {
  const files = await FileSystem.readDirectoryAsync(dir).catch(() => [] as string[]);
  await Promise.all(
    files.map(async (file) => {
      const id = file.replace(/\.jpg$/, '');
      if (keepIds.has(id)) return;
      cache.delete(id);
      await FileSystem.deleteAsync(`${dir}${file}`, { idempotent: true }).catch(() => {});
    }),
  );
}

async function downloadIfMissing(
  memory: Memory,
  storagePath: string,
  destPath: string,
  cache: Map<string, string>,
  urlCache: Map<string, Entry>,
): Promise<void> {
  const info = await FileSystem.getInfoAsync(destPath).catch(() => null);
  if (info?.exists) {
    cache.set(memory.id, destPath);
    return;
  }
  const url = await getSignedUrl('memories', storagePath);
  write(urlCache, memory.id, url);
  await FileSystem.downloadAsync(url, destPath);
  cache.set(memory.id, destPath);
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  async function next(): Promise<void> {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx]).catch(() => {});
    }
  }
  await Promise.all(
    Array(Math.max(1, concurrency))
      .fill(0)
      .map(() => next()),
  );
}

let cacheSyncing = false;

export async function syncOfflineCache(
  memories: Memory[],
  fullCount = PERSIST_TOP_N,
): Promise<void> {
  if (cacheSyncing) return;
  cacheSyncing = true;
  try {
    await Promise.all([ensureDir(THUMB_DIR), ensureDir(FULL_DIR)]);

    const eligible = memories.filter(
      (m) =>
        !m.galleryAssetId &&
        !m.localPath &&
        (m.thumbnailUrl || m.mediaUrl),
    );
    const fullEligible = eligible.filter((m) => m.mediaUrl);
    const topFulls = fullEligible.slice(0, fullCount);

    const thumbKeep = new Set(eligible.map((m) => m.id));
    const fullKeep = new Set(topFulls.map((m) => m.id));

    await Promise.all([
      pruneDir(THUMB_DIR, thumbKeep, persistedThumb),
      pruneDir(FULL_DIR, fullKeep, persistedFull),
    ]);

    await Promise.all([
      runWithConcurrency(eligible, 4, (memory) =>
        downloadIfMissing(
          memory,
          memory.thumbnailUrl || memory.mediaUrl,
          persistedThumbPath(memory.id),
          persistedThumb,
          thumbUrls,
        ),
      ),
      runWithConcurrency(topFulls, 2, (memory) =>
        downloadIfMissing(
          memory,
          memory.mediaUrl,
          persistedFullPath(memory.id),
          persistedFull,
          fullUrls,
        ),
      ),
    ]);
  } finally {
    cacheSyncing = false;
  }
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
