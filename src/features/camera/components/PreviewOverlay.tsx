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
  Image as SkiaImage,
  ImageFormat,
  useCanvasRef,
  useImage,
  type SkPath,
} from '@shopify/react-native-skia';
import { Ionicons } from '@expo/vector-icons';
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
  const compositeRef = useCanvasRef();
  const skImage = useImage(uri);

  const imageTransform = facing === 'front' ? [{ scaleX: -1 }] : [];

  // Flatten the displayed image + drawings into a single JPEG so recipients
  // receive exactly what the sender saw. Without this, the raw camera frame
  // would ship upstream and all the user's Skia annotations get lost.
  async function exportComposite(): Promise<string> {
    if (completedPaths.length === 0 && facing !== 'front') return uri;
    if (!skImage) return uri;
    const snap = compositeRef.current?.makeImageSnapshot();
    if (!snap) return uri;
    const base64 = snap.encodeToBase64(ImageFormat.JPEG, 92);
    const out = `${FileSystem.cacheDirectory}snap_composite_${Date.now()}.jpg`;
    await FileSystem.writeAsStringAsync(out, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return out;
  }

  async function handleSendTo() {
    if (directRecipient) {
      setSendingDirect(true);
      try {
        const { useAuthStore } = await import('@features/auth/store/authStore');
        const me = useAuthStore.getState().profile;
        if (!me) throw new Error('Not signed in');
        const flatUri = await exportComposite();
        await sendSnapToRecipients({
          senderId: me.id,
          senderName: me.display_name,
          imageUri: flatUri,
          recipientIds: [directRecipient.id],
        });
        reset();
      } catch (err) {
        Alert.alert(
          'Could not send',
          err instanceof Error ? err.message : 'Please try again.',
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
          'Permission required',
          'Allow photo library access so we can save snaps to your gallery.',
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
      Alert.alert('Could not save', 'Please try again.');
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

      {completedPaths.length > 0 && (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          {completedPaths.map((p, i) => (
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
      )}

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
            className={`w-10 h-10 rounded-full bg-black/60 items-center justify-center ${canUndo ? 'opacity-100' : 'opacity-30'}`}
            style={{ marginLeft: 8 }}>
            <Ionicons name="arrow-undo" size={20} color="#fff" />
          </Pressable>
        )}

        {isEditing ? (
          <Pressable
            onPress={onExitEdit}
            hitSlop={12}
            className="bg-white rounded-full px-5 py-2"
            style={{ marginRight: 8 }}>
            <Text className="text-black font-bold text-base">Done</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onEnterEdit}
            hitSlop={12}
            className="w-10 h-10 rounded-full bg-black/50 items-center justify-center">
            <Ionicons name="pencil" size={20} color="#fff" />
          </Pressable>
        )}
      </SafeAreaView>

      <View style={styles.bottomBar} pointerEvents="box-none">
        <Pressable
          onPress={handleSave}
          disabled={saving || justSaved}
          className={`w-14 h-14 rounded-full items-center justify-center ${justSaved ? 'bg-snap-yellow' : 'bg-black/60'}`}>
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
          className={`flex-row items-center bg-snap-yellow rounded-full px-6 py-3 gap-1 ${sendingDirect ? 'opacity-60' : ''}`}>
          {sendingDirect ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <>
              <Text
                className="text-black font-bold text-base"
                numberOfLines={1}>
                {directRecipient
                  ? `Send to ${directRecipient.displayName.split(' ')[0]}`
                  : 'Send To'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#000" />
            </>
          )}
        </Pressable>
      </View>

      {topLayer}

      {/*
        Hidden off-screen composite canvas. Skia renders both the captured
        image and the completed paths into a single GPU surface; a ref
        snapshot of that surface is what we actually upload, so the
        recipient gets the sender's drawings baked in. pointerEvents='none'
        keeps it invisible to touch handling; opacity:0 keeps it out of sight
        while remaining mounted so makeImageSnapshot has something to read.
      */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: COMPOSE_W,
          height: COMPOSE_H,
          opacity: 0,
        }}>
        <Canvas ref={compositeRef} style={{ width: COMPOSE_W, height: COMPOSE_H }}>
          {skImage && (
            <SkiaImage
              image={skImage}
              x={0}
              y={0}
              width={COMPOSE_W}
              height={COMPOSE_H}
              fit="cover"
              transform={facing === 'front' ? [{ scaleX: -1 }] : undefined}
              origin={
                facing === 'front'
                  ? { x: COMPOSE_W / 2, y: COMPOSE_H / 2 }
                  : undefined
              }
            />
          )}
          {completedPaths.map((p, i) => (
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
      </View>

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
