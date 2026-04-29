import { useEffect } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { Q } from '@nozbe/watermelondb';
import { database } from '@lib/watermelondb/database';
import Memory from '@lib/watermelondb/models/Memory';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';
import { useNetworkStore } from '@lib/offline/networkStore';
import {
  ingestGalleryAlbum,
  backfillGalleryIdsFromCameraRoll,
} from './galleryIngest';
import { invalidateMemory } from './memoryImageCache';

const MERGE_TOLERANCE_MS = 30_000;

interface BootstrapState {
  ingestDone: boolean;
  ingesting: boolean;
  serverSyncAttempted: boolean;
  serverSyncing: boolean;
  setIngestDone: () => void;
  setIngesting: (v: boolean) => void;
  setServerSyncAttempted: () => void;
  setServerSyncing: (v: boolean) => void;
  reset: () => void;
}

export const useMemoriesBootstrapStore = create<BootstrapState>((set) => ({
  ingestDone: false,
  ingesting: false,
  serverSyncAttempted: false,
  serverSyncing: false,
  setIngestDone: () => set({ ingestDone: true, ingesting: false }),
  setIngesting: (v) => set({ ingesting: v }),
  setServerSyncAttempted: () =>
    set({ serverSyncAttempted: true, serverSyncing: false }),
  setServerSyncing: (v) => set({ serverSyncing: v }),
  reset: () =>
    set({
      ingestDone: false,
      ingesting: false,
      serverSyncAttempted: false,
      serverSyncing: false,
    }),
}));

interface ServerRow {
  id: string;
  media_url: string;
  thumbnail_url: string;
  source: string;
  created_at: string;
  user_id?: string;
}

let ingestPromise: Promise<void> | null = null;
let serverSyncPromise: Promise<void> | null = null;
let lastUserId: string | null = null;

export function runMemoriesIngest(): Promise<void> {
  if (ingestPromise) return ingestPromise;
  useMemoriesBootstrapStore.getState().setIngesting(true);
  ingestPromise = (async () => {
    try {
      await backfillGalleryIdsFromCameraRoll().catch(() => 0);
      await ingestGalleryAlbum().catch(() => null);
    } finally {
      useMemoriesBootstrapStore.getState().setIngestDone();
      ingestPromise = null;
    }
  })();
  return ingestPromise;
}

export function runMemoriesServerSync(userId: string): Promise<void> {
  if (serverSyncPromise) return serverSyncPromise;
  useMemoriesBootstrapStore.getState().setServerSyncing(true);
  serverSyncPromise = (async () => {
    let createdRows = 0;
    try {
      const { data: remote, error } = await supabase
        .from('memories')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const remoteRows = (remote ?? []) as ServerRow[];
      const remoteIds = new Set(remoteRows.map((r) => r.id));

      const local = await database
        .get<Memory>('memories')
        .query(Q.where('deleted_at', null))
        .fetch();

      const knownRemoteIds = new Set(
        local.map((m) => m.remoteId).filter((id): id is string => !!id),
      );
      const unlinked = local.filter((m) => !m.remoteId);
      const used = new Set<string>();

      const toLink: { memory: Memory; row: ServerRow }[] = [];
      const toCreate: ServerRow[] = [];
      const toTombstone = local.filter(
        (m) => m.remoteId && !remoteIds.has(m.remoteId),
      );

      const incoming = remoteRows.filter((r) => !knownRemoteIds.has(r.id));
      for (const row of incoming) {
        const remoteCreated = new Date(row.created_at).getTime();
        let bestMatch: Memory | null = null;
        let bestDiff = Infinity;
        for (const m of unlinked) {
          if (used.has(m.id)) continue;
          const diff = Math.abs(m.createdAt - remoteCreated);
          if (diff > MERGE_TOLERANCE_MS) continue;
          if (diff < bestDiff) {
            bestDiff = diff;
            bestMatch = m;
          }
        }
        if (bestMatch) {
          used.add(bestMatch.id);
          toLink.push({ memory: bestMatch, row });
        } else {
          toCreate.push(row);
        }
      }

      const hasWork =
        toLink.length > 0 || toCreate.length > 0 || toTombstone.length > 0;

      if (hasWork) {
        await database.write(async () => {
          const collection = database.get<Memory>('memories');
          for (const { memory, row } of toLink) {
            await memory.update((m) => {
              m.remoteId = row.id;
              m.mediaUrl = row.media_url;
              m.thumbnailUrl = row.thumbnail_url;
              m.uploadStatus = 'done';
            });
          }
          for (const row of toCreate) {
            await collection.create((m) => {
              m.remoteId = row.id;
              m.mediaUrl = row.media_url;
              m.thumbnailUrl = row.thumbnail_url;
              m.source = row.source as Memory['source'];
              m.createdAt = new Date(row.created_at).getTime();
              m.uploadStatus = 'done';
              m.localPath = null;
              m.galleryAssetId = null;
              m.deletedAt = null;
            });
          }
          const now = Date.now();
          for (const m of toTombstone) {
            await m.update((row) => {
              row.deletedAt = now;
            });
          }
        });

        for (const m of toTombstone) {
          invalidateMemory(m.id);
        }
      }

      createdRows = toCreate.length;
    } catch (err) {
      console.warn('[Memories] Sync failed:', err);
    } finally {
      useMemoriesBootstrapStore.getState().setServerSyncAttempted();
      serverSyncPromise = null;
    }

    // After server sync inserts new rows that aren't yet linked to a gallery
    // asset, scan the camera roll to link them by creationTime. This is what
    // makes offline access work on a device that didn't capture the photos
    // in-app — the row exists in the DB *and* points at a local gallery URI.
    if (createdRows > 0) {
      await backfillGalleryIdsFromCameraRoll().catch(() => 0);
    }
  })();
  return serverSyncPromise;
}

export function useMemoriesBootstrap(): void {
  const profileId = useAuthStore((s) => s.profile?.id ?? null);
  const isOnline = useNetworkStore((s) => s.isOnline);

  useEffect(() => {
    if (profileId !== lastUserId) {
      ingestPromise = null;
      serverSyncPromise = null;
      useMemoriesBootstrapStore.getState().reset();
      lastUserId = profileId;
    }
    if (!profileId) return;
    (async () => {
      await runMemoriesIngest();
      await runMemoriesServerSync(profileId);
    })();
  }, [profileId]);

  // App foreground: re-run gallery ingest + server sync to pick up new
  // captures and any server-side changes from other devices.
  useEffect(() => {
    if (!profileId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      (async () => {
        await runMemoriesIngest();
        await runMemoriesServerSync(profileId);
      })();
    });
    return () => sub.remove();
  }, [profileId]);

  // Online reconnect: re-run server sync (the previous attempt may have
  // failed offline, so user data could still be missing locally).
  useEffect(() => {
    if (!profileId) return;
    if (!isOnline) return;
    runMemoriesServerSync(profileId);
  }, [profileId, isOnline]);
}
