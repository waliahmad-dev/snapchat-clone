import React, { useState } from 'react';
import {
  View,
  Image,
  Pressable,
  Text,
  Alert,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Canvas,
  Path,
  Skia,
  Image as SkiaImage,
  ImageFormat,
  PaintStyle,
  StrokeCap,
  StrokeJoin,
  useCanvasRef,
  useImage,
  type SkPath,
} from '@shopify/react-native-skia';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { RecipientSelector } from './RecipientSelector';
import { useMemoryUpload } from '@features/memories/hooks/useMemoryUpload';
import { useCameraStore, type CameraFacing } from '../store/cameraStore';
import { sendSnapToRecipients } from '../utils/sendSnap';

interface CompletedPath {
  path: SkPath;
  color: string;
  strokeWidth: number;
}

interface Props {
  uri: string;
  facing: CameraFacing;
  completedPaths: CompletedPath[];
  isEditing: boolean;
  onClose: () => void;
  onEnterEdit: () => void;
  onExitEdit: () => void;
  onUndo: () => void;
  canUndo: boolean;

  drawingLayer?: React.ReactNode;
  topLayer?: React.ReactNode;
}

export function PreviewOverlay({
  uri,
  facing,
  completedPaths,
  isEditing,
  onClose,
  onEnterEdit,
  onExitEdit,
  onUndo,
  canUndo,
  drawingLayer,
  topLayer,
}: Props) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [sendingDirect, setSendingDirect] = useState(false);
  const [showRecipients, setShowRecipients] = useState(false);
  const [recipientUri, setRecipientUri] = useState<string | null>(null);
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const { saveToMemories } = useMemoryUpload();
  const directRecipient = useCameraStore((s) => s.directRecipient);
  const reset = useCameraStore((s) => s.reset);

  const { width: COMPOSE_W, height: COMPOSE_H } = useWindowDimensions();
  const skImage = useImage(uri);
  const compositeRef = useCanvasRef();

  const imageTransform = facing === 'front' ? [{ scaleX: -1 }] : [];

  async function writeBase64Jpeg(base64: string): Promise<string> {
    const out = `${FileSystem.cacheDirectory}snap_composite_${Date.now()}.jpg`;
    await FileSystem.writeAsStringAsync(out, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return out;
  }

  async function exportComposite(): Promise<string> {
    if (completedPaths.length === 0 && facing !== 'front') return uri;

    let sourceImage = skImage;
    if (!sourceImage) {
      const data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const skData = Skia.Data.fromBase64(data);
      sourceImage = Skia.Image.MakeImageFromEncoded(skData);
    }
    if (!sourceImage) return uri;

    const W = Math.round(COMPOSE_W);
    const H = Math.round(COMPOSE_H);
    const surface = Skia.Surface.MakeOffscreen(W, H);
    if (!surface) return uri;
    const canvas = surface.getCanvas();

    const imgW = sourceImage.width();
    const imgH = sourceImage.height();
    const srcAspect = imgW / imgH;
    const dstAspect = W / H;
    let srcX = 0;
    let srcY = 0;
    let srcW = imgW;
    let srcH = imgH;
    if (srcAspect > dstAspect) {
      srcW = imgH * dstAspect;
      srcX = (imgW - srcW) / 2;
    } else {
      srcH = imgW / dstAspect;
      srcY = (imgH - srcH) / 2;
    }

    const imgPaint = Skia.Paint();
    imgPaint.setAntiAlias(true);

    if (facing === 'front') {
      canvas.save();
      canvas.translate(W, 0);
      canvas.scale(-1, 1);
    }
    canvas.drawImageRect(
      sourceImage,
      Skia.XYWHRect(srcX, srcY, srcW, srcH),
      Skia.XYWHRect(0, 0, W, H),
      imgPaint
    );
    if (facing === 'front') canvas.restore();

    for (const p of completedPaths) {
      const paint = Skia.Paint();
      paint.setColor(Skia.Color(p.color));
      paint.setStrokeWidth(p.strokeWidth);
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeCap(StrokeCap.Round);
      paint.setStrokeJoin(StrokeJoin.Round);
      paint.setAntiAlias(true);
      canvas.drawPath(p.path, paint);
    }

    const snapshot = surface.makeImageSnapshot();
    const base64 = snapshot.encodeToBase64(ImageFormat.JPEG, 92);
    return writeBase64Jpeg(base64);
  }

  async function handleSendTo() {
    if (directRecipient) {
      setSendingDirect(true);
      try {
        const { useAuthStore } = await import('@features/auth/store/authStore');
        const me = useAuthStore.getState().profile;
        if (!me) throw new Error('Not signed in');
        const flatUri = await exportComposite();
        const isGroup = directRecipient.kind === 'group';
        await sendSnapToRecipients({
          senderId: me.id,
          senderName: me.display_name,
          imageUri: flatUri,
          recipientIds: isGroup ? [] : [directRecipient.id],
          groupIds: isGroup ? [directRecipient.id] : [],
        });
        reset();
      } catch (err) {
        Alert.alert(
          t('camera.preview.couldNotSendTitle'),
          err instanceof Error ? err.message : t('common.tryAgain'),
        );
      } finally {
        setSendingDirect(false);
      }
      return;
    }
    const flatUri = await exportComposite();
    setRecipientUri(flatUri);
    setShowRecipients(true);
  }

  async function handleSave() {
    if (!mediaPermission?.granted) {
      const { granted } = await requestMediaPermission();
      if (!granted) {
        Alert.alert(
          t('camera.preview.permissionRequiredTitle'),
          t('camera.preview.permissionRequiredBody'),
        );
        return;
      }
    }
    if (justSaved) return;

    setSaving(true);
    try {
      const flatUri = await exportComposite();
      await saveToMemories(flatUri, 'camera');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setJustSaved(true);
    } catch {
      Alert.alert(t('camera.preview.couldNotSaveTitle'), t('common.tryAgain'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Image
        source={{ uri }}
        style={[StyleSheet.absoluteFill, { transform: imageTransform }]}
        resizeMode="cover"
      />

      <Canvas ref={compositeRef} style={StyleSheet.absoluteFill} pointerEvents="none">
        {skImage && (
          <SkiaImage
            image={skImage}
            x={0}
            y={0}
            width={COMPOSE_W}
            height={COMPOSE_H}
            fit="cover"
            transform={facing === 'front' ? [{ scaleX: -1 }] : undefined}
            origin={facing === 'front' ? { x: COMPOSE_W / 2, y: COMPOSE_H / 2 } : undefined}
          />
        )}
        {!isEditing &&
          completedPaths.map((p, i) => (
            <Path
              key={i}
              path={p.path}
              color={p.color}
              style="stroke"
              strokeWidth={p.strokeWidth}
              strokeCap="round"
              strokeJoin="round"
            />
          ))}
      </Canvas>

      {drawingLayer}

      <SafeAreaView style={styles.topBar} pointerEvents="box-none">
        {!isEditing ? (
          <Pressable onPress={onClose} hitSlop={12} className="p-2">
            <Ionicons name="close" size={30} color="#fff" />
          </Pressable>
        ) : (
          <Pressable
            onPress={onUndo}
            disabled={!canUndo}
            hitSlop={12}
            className={`h-10 w-10 items-center justify-center rounded-full bg-black/60 ${canUndo ? 'opacity-100' : 'opacity-30'}`}
            style={{ marginLeft: 8 }}>
            <Ionicons name="arrow-undo" size={20} color="#fff" />
          </Pressable>
        )}

        {isEditing ? (
          <Pressable
            onPress={onExitEdit}
            hitSlop={12}
            className="rounded-full bg-white px-5 py-2"
            style={{ marginRight: 8 }}>
            <Text className="text-base font-bold text-black">{t('common.done')}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onEnterEdit}
            hitSlop={12}
            className="h-10 w-10 items-center justify-center rounded-full bg-black/50">
            <Ionicons name="pencil" size={20} color="#fff" />
          </Pressable>
        )}
      </SafeAreaView>

      <View style={styles.bottomBar} pointerEvents="box-none">
        <Pressable
          onPress={handleSave}
          disabled={saving || justSaved}
          className={`h-14 w-14 items-center justify-center rounded-full ${justSaved ? 'bg-snap-yellow' : 'bg-black/60'}`}>
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : justSaved ? (
            <Ionicons name="checkmark" size={26} color="#000" />
          ) : (
            <Ionicons name="download-outline" size={24} color="#fff" />
          )}
        </Pressable>

        <Pressable
          onPress={handleSendTo}
          disabled={sendingDirect}
          className={`flex-row items-center gap-1 rounded-full bg-snap-yellow px-6 py-3 ${sendingDirect ? 'opacity-60' : ''}`}>
          {sendingDirect ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <>
              <Text className="text-base font-bold text-black" numberOfLines={1}>
                {directRecipient
                  ? t('camera.preview.sendToFriend', {
                      name: directRecipient.displayName.split(' ')[0],
                    })
                  : t('camera.preview.sendTo')}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#000" />
            </>
          )}
        </Pressable>
      </View>

      {topLayer}

      {showRecipients && recipientUri && (
        <RecipientSelector
          imageUri={recipientUri}
          onClose={() => {
            setShowRecipients(false);
            setRecipientUri(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 48,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
