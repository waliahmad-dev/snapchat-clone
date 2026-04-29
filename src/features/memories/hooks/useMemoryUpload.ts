import { useCallback } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { database } from '@lib/watermelondb/database';
import Memory from '@lib/watermelondb/models/Memory';
import { useAuthStore } from '@features/auth/store/authStore';
import { enqueueJob } from '@lib/offline/outboxRunner';
import { JOB } from '@lib/offline/jobs';
import { persistMedia } from '@lib/offline/persistMedia';
import { uuid } from '@lib/offline/uuid';
import { addAssetToMemoriesAlbum } from '@features/memories/lib/galleryIngest';

export function useMemoryUpload() {
  const profile = useAuthStore((s) => s.profile);

  const saveToMemories = useCallback(
    async (localUri: string, source: Memory['source'] = 'camera'): Promise<void> => {
      if (!profile) return;

      const memoryUuid = uuid();
      const persistedPath = await persistMedia(localUri, `memory_${memoryUuid}.jpg`);

      let galleryAssetId: string | null = null;
      const { granted } = await MediaLibrary.getPermissionsAsync();
      if (granted) {
        try {
          const asset = await MediaLibrary.createAssetAsync(localUri);
          galleryAssetId = asset.id;
          await addAssetToMemoriesAlbum(asset.id);
        } catch {
          await MediaLibrary.saveToLibraryAsync(localUri).catch(() => {});
        }
      }

      let localRecord: Memory | null = null;
      await database.write(async () => {
        localRecord = await database.get<Memory>('memories').create((m) => {
          m.mediaUrl = persistedPath;
          m.thumbnailUrl = persistedPath;
          m.source = source;
          m.createdAt = Date.now();
          m.uploadStatus = 'pending';
          m.localPath = persistedPath;
          m.galleryAssetId = galleryAssetId;
        });
      });

      if (!localRecord) return;
      await enqueueJob({
        kind: JOB.MEMORY_UPLOAD,
        payload: {
          memoryId: (localRecord as Memory).id,
          userId: profile.id,
          source,
        },
        groupKey: `memory:${(localRecord as Memory).id}`,
      });
    },
    [profile],
  );

  return { saveToMemories };
}
