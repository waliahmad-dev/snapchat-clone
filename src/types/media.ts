export interface ProcessedImage {
  full: { uri: string; width: number; height: number };
  preview: { uri: string; width: number; height: number };
  thumbnail: { uri: string; width: number; height: number };
}

export interface SnapPayload {
  recipientId: string;
  mediaUrl: string;
  conversationId: string;
}

export interface UploadResult {
  path: string;
  bucket: string;
  signedUrl: string;
}

export type StorageBucket = 'snaps' | 'memories' | 'stories' | 'profiles';
