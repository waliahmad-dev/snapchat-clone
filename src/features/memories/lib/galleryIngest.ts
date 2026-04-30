import * as MediaLibrary from 'expo-media-library';
import { database } from '@lib/watermelondb/database';
import Memory from '@lib/watermelondb/models/Memory';

export const MEMORIES_ALBUM_NAME = 'Snapchat Clone';
const TIME_TOLERANCE_MS = 30_000;
const MAX_PAGE_SIZE = 200;

export async function getOrCreateMemoriesAlbum(
  seedAssetId?: string,
): Promise<MediaLibrary.Album | null> {
  try {
    const existing = await MediaLibrary.getAlbumAsync(MEMORIES_ALBUM_NAME);
    if (existing) return existing;
    if (!seedAssetId) return null;
    return await MediaLibrary.createAlbumAsync(
      MEMORIES_ALBUM_NAME,
      seedAssetId,
      false,
    );
  } catch {
    return null;
  }
}

export async function addAssetToMemoriesAlbum(assetId: string): Promise<void> {
  try {
    const album = await getOrCreateMemoriesAlbum(assetId);
    if (!album) return;
    await MediaLibrary.addAssetsToAlbumAsync([assetId], album.id, false).catch(
      () => {},
    );
  } catch {
    // best effort
  }
}

async function readAlbumAssets(
  albumId: string,
): Promise<MediaLibrary.Asset[]> {
  const all: MediaLibrary.Asset[] = [];
  let cursor: string | undefined;
  do {
    const page = await MediaLibrary.getAssetsAsync({
      album: albumId,
      mediaType: ['photo'],
      first: MAX_PAGE_SIZE,
      after: cursor,
      sortBy: ['creationTime'],
    }).catch(() => null);
    if (!page) break;
    all.push(...page.assets);
    cursor = page.hasNextPage ? page.endCursor : undefined;
  } while (cursor);
  return all;
}

interface IngestSummary {
  linked: number;
  created: number;
}

const BACKFILL_WINDOW_BUFFER_MS = 60_000;
const BACKFILL_MAX_CANDIDATES = 5_000;

export async function backfillGalleryIdsFromCameraRoll(): Promise<number> {
  const { granted } = await MediaLibrary.getPermissionsAsync();
  if (!granted) return 0;

  const all = await database.get<Memory>('memories').query().fetch();
  const linkedAssetIds = new Set(
    all.map((m) => m.galleryAssetId).filter((id): id is string => !!id),
  );
  const needBackfill = all.filter(
    (m) => !m.galleryAssetId && !m.deletedAt && !m.localPath,
  );
  if (needBackfill.length === 0) return 0;

  let minTime = Infinity;
  let maxTime = -Infinity;
  for (const m of needBackfill) {
    if (m.createdAt < minTime) minTime = m.createdAt;
    if (m.createdAt > maxTime) maxTime = m.createdAt;
  }

  const candidates: { id: string; creationTime: number }[] = [];
  let cursor: string | undefined;
  do {
    const page = await MediaLibrary.getAssetsAsync({
      mediaType: ['photo'],
      createdAfter: minTime - BACKFILL_WINDOW_BUFFER_MS,
      createdBefore: maxTime + BACKFILL_WINDOW_BUFFER_MS,
      first: MAX_PAGE_SIZE,
      after: cursor,
      sortBy: ['creationTime'],
    }).catch(() => null);
    if (!page) break;
    for (const a of page.assets) {
      if (linkedAssetIds.has(a.id)) continue;
      candidates.push({ id: a.id, creationTime: a.creationTime });
    }
    cursor = page.hasNextPage ? page.endCursor : undefined;
  } while (cursor && candidates.length < BACKFILL_MAX_CANDIDATES);

  if (candidates.length === 0) return 0;

  const used = new Set<string>();
  const matches: { memory: Memory; assetId: string }[] = [];
  for (const memory of needBackfill) {
    let best: { id: string; diff: number } | null = null;
    for (const c of candidates) {
      if (used.has(c.id)) continue;
      const diff = Math.abs(c.creationTime - memory.createdAt);
      if (diff > TIME_TOLERANCE_MS) continue;
      if (!best || diff < best.diff) best = { id: c.id, diff };
    }
    if (best) {
      used.add(best.id);
      matches.push({ memory, assetId: best.id });
    }
  }

  if (matches.length === 0) return 0;

  await database.write(async () => {
    for (const { memory, assetId } of matches) {
      await memory.update((m) => {
        m.galleryAssetId = assetId;
      });
    }
  });

  for (const { assetId } of matches) {
    await addAssetToMemoriesAlbum(assetId);
  }

  return matches.length;
}

export async function ingestGalleryAlbum(): Promise<IngestSummary> {
  const summary: IngestSummary = { linked: 0, created: 0 };

  const { granted } = await MediaLibrary.getPermissionsAsync();
  if (!granted) return summary;

  const album = await getOrCreateMemoriesAlbum();
  if (!album) return summary;

  const assets = await readAlbumAssets(album.id);
  if (assets.length === 0) return summary;

  const allLocal = await database.get<Memory>('memories').query().fetch();

  const localByAssetId = new Map<string, Memory>();
  const unlinked: Memory[] = [];
  for (const m of allLocal) {
    if (m.galleryAssetId) localByAssetId.set(m.galleryAssetId, m);
    else if (!m.deletedAt) unlinked.push(m);
  }
  const usedUnlinked = new Set<string>();

  const toLink: { memory: Memory; assetId: string }[] = [];
  const toCreate: MediaLibrary.Asset[] = [];

  for (const asset of assets) {
    if (localByAssetId.has(asset.id)) continue;

    let bestMatch: Memory | null = null;
    let bestDiff = Infinity;
    for (const m of unlinked) {
      if (usedUnlinked.has(m.id)) continue;
      const diff = Math.abs(m.createdAt - asset.creationTime);
      if (diff > TIME_TOLERANCE_MS) continue;
      if (diff < bestDiff) {
        bestDiff = diff;
        bestMatch = m;
      }
    }

    if (bestMatch) {
      usedUnlinked.add(bestMatch.id);
      toLink.push({ memory: bestMatch, assetId: asset.id });
    } else {
      toCreate.push(asset);
    }
  }

  if (toLink.length === 0 && toCreate.length === 0) return summary;

  await database.write(async () => {
    const collection = database.get<Memory>('memories');
    for (const { memory, assetId } of toLink) {
      await memory.update((m) => {
        m.galleryAssetId = assetId;
      });
    }
    for (const asset of toCreate) {
      await collection.create((m) => {
        m.remoteId = null;
        m.mediaUrl = '';
        m.thumbnailUrl = '';
        m.source = 'camera';
        m.createdAt = asset.creationTime;
        m.uploadStatus = 'gallery_only';
        m.localPath = null;
        m.galleryAssetId = asset.id;
        m.deletedAt = null;
      });
    }
  });

  summary.linked = toLink.length;
  summary.created = toCreate.length;
  return summary;
}
