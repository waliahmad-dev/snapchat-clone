import { useCallback } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { database } from '@lib/watermelondb/database';
import Memory from '@lib/watermelondb/models/Memory';
import { processImage } from '@lib/imageManipulator/processor';
import { uploadToStorage } from '@lib/supabase/storage';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';

export function useMemoryUpload() {
  const profile = useAuthStore((s) => s.profile);

  const saveToMemories = useCallback(
    async (localUri: string, source: Memory['source'] = 'camera'): Promise<void> => {
      if (!profile) return;

      let localRecord: Memory | null = null;
      await database.write(async () => {
        localRecord = await database.get<Memory>('memories').create((m) => {
          m.mediaUrl = localUri;
          m.thumbnailUrl = localUri;
          m.source = source;
          m.createdAt = Date.now();
          m.uploadStatus = 'pending';
          m.localPath = localUri;
        });
      });

      const { granted } = await MediaLibrary.getPermissionsAsync();
      if (granted) {
        await MediaLibrary.saveToLibraryAsync(localUri);
      }

      try {
        await database.write(async () => {
          await localRecord!.update((m) => {
            m.uploadStatus = 'uploading';
          });
        });

        const processed = await processImage(localUri);
        const id = `${profile.id}/${Date.now()}`;
        const fullPath = `${id}_full.jpg`;
        const thumbPath = `${id}_thumb.jpg`;

        await Promise.all([
          uploadToStorage('memories', fullPath, processed.full.uri),
          uploadToStorage('memories', thumbPath, processed.thumbnail.uri),
        ]);

        const { data } = await supabase.from('memories').insert({
          user_id: profile.id,
          media_url: fullPath,
          thumbnail_url: thumbPath,
          source,
        }).select().single();

        await database.write(async () => {
          await localRecord!.update((m) => {
            m.remoteId = data?.id ?? null;
            m.mediaUrl = fullPath;
            m.thumbnailUrl = thumbPath;
            m.uploadStatus = 'done';
          });
        });
      } catch (err) {
        await database.write(async () => {
          await localRecord!.update((m) => {
            m.uploadStatus = 'failed';
          });
        });
        console.error('[MemoryUpload] Failed:', err);
      }
    },
    [profile]
  );

  return { saveToMemories };
}
