import { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { database } from '@lib/watermelondb/database';
import Memory from '@lib/watermelondb/models/Memory';
import { Q } from '@nozbe/watermelondb';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';
import { getSignedUrl } from '@lib/supabase/storage';

export function useMemories() {
  const profile = useAuthStore((s) => s.profile);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    syncFromServer();
  }, [profile?.id]);

  useEffect(() => {
    const subscription = database
      .get<Memory>('memories')
      .query(Q.where('deleted_at', null))
      .observe()
      .subscribe((data) => {
        setMemories(data.sort((a, b) => b.createdAt - a.createdAt));
        setLoading(false);
      });
    return () => subscription.unsubscribe();
  }, []);

  async function syncFromServer() {
    if (!profile) return;
    try {
      const { data: remote } = await supabase
        .from('memories')
        .select('*')
        .eq('user_id', profile.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (!remote || remote.length === 0) return;

      const local = await database
        .get<Memory>('memories')
        .query(Q.where('deleted_at', null))
        .fetch();
      const knownRemoteIds = new Set(
        local.map((m) => m.remoteId).filter((id): id is string => !!id),
      );

      const missing = remote.filter(
        (r: { id: string }) => !knownRemoteIds.has(r.id),
      );
      if (missing.length === 0) return;

      await database.write(async () => {
        const collection = database.get<Memory>('memories');
        for (const row of missing as Array<{
          id: string;
          media_url: string;
          thumbnail_url: string;
          source: string;
          created_at: string;
        }>) {
          await collection.create((m) => {
            m.remoteId = row.id;
            m.mediaUrl = row.media_url;
            m.thumbnailUrl = row.thumbnail_url;
            m.source = row.source as Memory['source'];
            m.createdAt = new Date(row.created_at).getTime();
            m.uploadStatus = 'done';
            m.localPath = null;
            m.deletedAt = null;
          });
        }
      });
    } catch (err) {
      console.warn('[Memories] Sync failed:', err);
    }
  }


  async function getDisplayUrl(memory: Memory): Promise<string> {
    if (memory.uploadStatus !== 'done' && memory.localPath) {
      return memory.localPath;
    }
    return getSignedUrl('memories', memory.thumbnailUrl || memory.mediaUrl);
  }


  async function getFullUrl(memory: Memory): Promise<string> {
    if (memory.uploadStatus !== 'done' && memory.localPath) {
      return memory.localPath;
    }
    return getSignedUrl('memories', memory.mediaUrl);
  }


  async function ensureLocalCopy(memory: Memory): Promise<string> {
    if (memory.localPath) {
      const info = await FileSystem.getInfoAsync(memory.localPath);
      if (info.exists) return memory.localPath;
    }
    const signed = await getSignedUrl('memories', memory.mediaUrl);
    const destination = `${FileSystem.cacheDirectory}memory_${memory.id}.jpg`;
    const existing = await FileSystem.getInfoAsync(destination);
    if (existing.exists) return destination;
    const { uri } = await FileSystem.downloadAsync(signed, destination);
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

    await database.write(async () => {
      await memory.destroyPermanently();
    });
  }

  return {
    memories,
    loading,
    getDisplayUrl,
    getFullUrl,
    ensureLocalCopy,
    deleteMemory,
    refresh: syncFromServer,
  };
}
