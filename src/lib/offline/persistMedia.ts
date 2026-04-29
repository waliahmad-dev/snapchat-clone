import * as FileSystem from 'expo-file-system/legacy';

const OUTBOX_MEDIA_DIR = `${FileSystem.documentDirectory}outbox-media/`;

async function ensureDir(): Promise<void> {
  await FileSystem.makeDirectoryAsync(OUTBOX_MEDIA_DIR, {
    intermediates: true,
  }).catch(() => {});
}

export async function persistMedia(srcUri: string, name: string): Promise<string> {
  await ensureDir();
  const dest = `${OUTBOX_MEDIA_DIR}${name}`;
  await FileSystem.copyAsync({ from: srcUri, to: dest });
  return dest;
}

export async function deletePersistedMedia(uri: string): Promise<void> {
  if (!uri) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}

export async function persistedMediaExists(uri: string): Promise<boolean> {
  if (!uri) return false;
  const info = await FileSystem.getInfoAsync(uri).catch(() => null);
  return !!info?.exists;
}
