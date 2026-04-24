import * as ImageManipulator from 'expo-image-manipulator';
import type { ProcessedImage } from '@/types/media';
import {
  MAX_IMAGE_SIZE_PX,
  PREVIEW_IMAGE_SIZE_PX,
  THUMBNAIL_SIZE_PX,
  IMAGE_QUALITY_FULL,
  IMAGE_QUALITY_PREVIEW,
  IMAGE_QUALITY_THUMBNAIL,
} from '@constants/config';

const TARGET_ASPECT = 9 / 16; 

async function getDimensions(uri: string): Promise<{ width: number; height: number }> {
  const info = await ImageManipulator.manipulateAsync(uri, [], {});
  return { width: info.width, height: info.height };
}


export async function cropTo916(uri: string): Promise<string> {
  const { width, height } = await getDimensions(uri);
  const sourceAspect = width / height;

  if (Math.abs(sourceAspect - TARGET_ASPECT) < 0.01) return uri;

  let originX = 0;
  let originY = 0;
  let cropWidth = width;
  let cropHeight = height;

  if (sourceAspect > TARGET_ASPECT) {
    cropWidth = Math.round(height * TARGET_ASPECT);
    originX = Math.round((width - cropWidth) / 2);
  } else {
    cropHeight = Math.round(width / TARGET_ASPECT);
    originY = Math.round((height - cropHeight) / 2);
  }

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: { originX, originY, width: cropWidth, height: cropHeight } }],
    { format: ImageManipulator.SaveFormat.JPEG, compress: 1 },
  );
  return result.uri;
}

export async function processImage(uri: string): Promise<ProcessedImage> {
  const cropped = await cropTo916(uri);

  const [full, preview, thumbnail] = await Promise.all([
    ImageManipulator.manipulateAsync(
      cropped,
      [{ resize: { width: MAX_IMAGE_SIZE_PX } }],
      { compress: IMAGE_QUALITY_FULL, format: ImageManipulator.SaveFormat.JPEG },
    ),
    ImageManipulator.manipulateAsync(
      cropped,
      [{ resize: { width: PREVIEW_IMAGE_SIZE_PX } }],
      { compress: IMAGE_QUALITY_PREVIEW, format: ImageManipulator.SaveFormat.JPEG },
    ),
    // Thumbnail preserves 9:16 (source is already cropTo916'd) — resizing
    // with only width avoids squashing portrait snaps into a square.
    ImageManipulator.manipulateAsync(
      cropped,
      [{ resize: { width: THUMBNAIL_SIZE_PX } }],
      { compress: IMAGE_QUALITY_THUMBNAIL, format: ImageManipulator.SaveFormat.JPEG },
    ),
  ]);

  return {
    full: { uri: full.uri, width: full.width, height: full.height },
    preview: { uri: preview.uri, width: preview.width, height: preview.height },
    thumbnail: { uri: thumbnail.uri, width: thumbnail.width, height: thumbnail.height },
  };
}

export async function compressImage(uri: string, quality = IMAGE_QUALITY_FULL): Promise<string> {
  const cropped = await cropTo916(uri);
  const result = await ImageManipulator.manipulateAsync(
    cropped,
    [{ resize: { width: MAX_IMAGE_SIZE_PX } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}
