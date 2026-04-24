import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './client';
import type { StorageBucket } from '@/types/media';
import { SIGNED_URL_EXPIRY_SECONDS } from '@constants/config';

function base64ToUint8Array(base64: string): Uint8Array {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalAtob: (s: string) => string = (globalThis as any).atob ?? ((s: string) => Buffer.from(s, 'base64').toString('binary'));
  const binary = globalAtob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function uploadToStorage(
  bucket: StorageBucket,
  path: string,
  localUri: string,
): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = base64ToUint8Array(base64);

  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
  });

  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

export async function getSignedUrl(
  bucket: StorageBucket,
  path: string,
  expiresIn = SIGNED_URL_EXPIRY_SECONDS,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) throw new Error(`Signed URL failed: ${error?.message}`);
  return data.signedUrl;
}

export async function getPublicUrl(bucket: StorageBucket, path: string): Promise<string> {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteFromStorage(bucket: StorageBucket, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

export async function downloadToCache(signedUrl: string, filename: string): Promise<string> {
  const localPath = `${FileSystem.cacheDirectory}${filename}`;
  const existing = await FileSystem.getInfoAsync(localPath);
  if (existing.exists) return localPath;

  const result = await FileSystem.downloadAsync(signedUrl, localPath);
  return result.uri;
}
