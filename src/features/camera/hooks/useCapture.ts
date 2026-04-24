import { useRef, useState } from 'react';
import type { CameraView } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { processImage } from '@lib/imageManipulator/processor';
import { uploadToStorage } from '@lib/supabase/storage';
import { useAuthStore } from '@features/auth/store/authStore';

export type CaptureState = 'idle' | 'capturing' | 'processing' | 'ready';

export function useCapture() {
  const cameraRef = useRef<CameraView>(null);
  const profile = useAuthStore((s) => s.profile);
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [processedPaths, setProcessedPaths] = useState<{
    full: string;
    preview: string;
    thumbnail: string;
  } | null>(null);

  async function capture() {
    if (!cameraRef.current || captureState !== 'idle') return;
    setCaptureState('capturing');
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
      if (!photo) throw new Error('No photo returned');
      setCapturedUri(photo.uri);
      setCaptureState('processing');

      const variants = await processImage(photo.uri);
      setProcessedPaths({
        full: variants.full.uri,
        preview: variants.preview.uri,
        thumbnail: variants.thumbnail.uri,
      });
      setCaptureState('ready');
    } catch {
      setCaptureState('idle');
    }
  }

  function discard() {
    setCapturedUri(null);
    setProcessedPaths(null);
    setCaptureState('idle');
  }

  async function saveToGallery(): Promise<void> {
    if (!capturedUri) return;
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') return;
    await MediaLibrary.saveToLibraryAsync(capturedUri);
  }

  async function uploadSnap(recipientId: string): Promise<string> {
    if (!processedPaths || !profile) throw new Error('Nothing to upload');
    const path = `${profile.id}/${recipientId}/${Date.now()}.jpg`;
    return uploadToStorage('snaps', path, processedPaths.full);
  }

  async function uploadStory(): Promise<string> {
    if (!processedPaths || !profile) throw new Error('Nothing to upload');
    const path = `${profile.id}/${Date.now()}.jpg`;
    return uploadToStorage('stories', path, processedPaths.full);
  }

  return {
    cameraRef,
    captureState,
    capturedUri,
    processedPaths,
    capture,
    discard,
    saveToGallery,
    uploadSnap,
    uploadStory,
  };
}
