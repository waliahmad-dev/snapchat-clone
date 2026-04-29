import { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { database } from '@lib/watermelondb/database';
import Memory from '@lib/watermelondb/models/Memory';
import { Q } from '@nozbe/watermelondb';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';
import {
  resolveThumbUrl,
  resolveFullUrl,
  syncOfflineCache,
  invalidateMemory,
} from '@features/memories/lib/memoryImageCache';
import {
  useMemoriesBootstrapStore,
  runMemoriesServerSync,
} from '@features/memories/lib/memoriesBootstrap';

export function useMemories() {
  const profile = useAuthStore((s) => s.profile);
  const ingestDone = useMemoriesBootstrapStore((s) => s.ingestDone);
  const serverSyncAttempted = useMemoriesBootstrapStore(
    (s) => s.serverSyncAttempted,
  );
  const serverSyncing = useMemoriesBootstrapStore((s) => s.serverSyncing);

  const [memories, setMemories] = useState<Memory[]>([]);

  useEffect(() => {
    const subscription = database
      .get<Memory>('memories')
      .query(Q.where('deleted_at', null))
      .observe()
      .subscribe((data) => {
        const sorted = data.sort((a, b) => b.createdAt - a.createdAt);
        setMemories(sorted);
        syncOfflineCache(sorted, 4).catch(() => {});
      });
    return () => subscription.unsubscribe();
  }, []);

  async function getDisplayUrl(memory: Memory): Promise<string> {
    return resolveThumbUrl(memory);
  }

  async function getFullUrl(memory: Memory): Promise<string> {
    return resolveFullUrl(memory);
  }

  async function ensureLocalCopy(memory: Memory): Promise<string> {
    if (memory.localPath) {
      const info = await FileSystem.getInfoAsync(memory.localPath);
      if (info.exists) return memory.localPath;
    }
    if (memory.galleryAssetId) {
      try {
        const info = await MediaLibrary.getAssetInfoAsync(memory.galleryAssetId);
        const localUri = info?.localUri || info?.uri;
        if (localUri && localUri.startsWith('file://')) return localUri;
      } catch {
        // fall through
      }
    }
    const resolved = await resolveFullUrl(memory);
    if (resolved.startsWith('file://')) return resolved;
    const destination = `${FileSystem.cacheDirectory}memory_${memory.id}.jpg`;
    const existing = await FileSystem.getInfoAsync(destination);
    if (existing.exists) return destination;
    const { uri } = await FileSystem.downloadAsync(resolved, destination);
    return uri;
  }

  async function deleteMemory(memory: Memory): Promise<void> {
    if (memory.remoteId) {
      const storagePaths = [memory.mediaUrl, memory.thumbnailUrl].filter(
        (p): p is string => !!p && !p.startsWith('file://'),
      );
      if (storagePaths.length > 0) {
        const { error: storageErr } = await supabase.storage
          .from('memories')
          .remove(storagePaths);
        if (storageErr) {
          console.warn('[Memories] storage remove failed:', storageErr.message);
        }
      }

      const { error: dbErr } = await supabase
        .from('memories')
        .delete()
        .eq('id', memory.remoteId);
      if (dbErr) throw dbErr;
    }

    invalidateMemory(memory.id);

    await database.write(async () => {
      if (memory.galleryAssetId) {
        await memory.update((m) => {
          m.deletedAt = Date.now();
        });
      } else {
        await memory.destroyPermanently();
      }
    });
  }

  // Show the spinner only when there's nothing to display *and* the bootstrap
  // hasn't yet had a chance to populate the DB. As soon as memories arrive
  // (from gallery ingest or server sync) we drop straight into the grid.
  const bootstrapped = ingestDone && serverSyncAttempted;
  const loading = !bootstrapped && memories.length === 0;
  const syncing = serverSyncing;

  return {
    memories,
    loading,
    syncing,
    getDisplayUrl,
    getFullUrl,
    ensureLocalCopy,
    deleteMemory,
    refresh: () => (profile ? runMemoriesServerSync(profile.id) : Promise.resolve()),
  };
}
