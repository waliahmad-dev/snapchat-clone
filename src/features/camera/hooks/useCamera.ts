import { useRef, useCallback } from 'react';
import { useCameraPermissions } from 'expo-camera';
import type { CameraView as CameraViewType } from 'expo-camera';

export function useCamera() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraViewType>(null);

  const takePicture = useCallback(async (): Promise<string | null> => {
    if (!cameraRef.current) return null;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: false,
      });
      return photo?.uri ?? null;
    } catch (err) {
      console.error('[Camera] takePicture error:', err);
      return null;
    }
  }, []);

  return {
    cameraRef,
    permission,
    requestPermission,
    takePicture,
    hasPermission: permission?.granted ?? false,
  };
}
