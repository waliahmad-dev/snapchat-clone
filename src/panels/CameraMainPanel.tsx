import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CameraViewComponent } from '@features/camera/components/CameraViewComponent';
import { SkiaCanvas } from '@features/camera/components/SkiaCanvas';
import { DrawingToolbar } from '@features/camera/components/DrawingToolbar';
import { CaptureButton } from '@features/camera/components/CaptureButton';
import { FlipButton } from '@features/camera/components/FlipButton';
import { FlashControl } from '@features/camera/components/FlashControl';
import { PreviewOverlay } from '@features/camera/components/PreviewOverlay';
import { ZoomBar, ZOOM_CEILING } from '@features/camera/components/ZoomBar';
import { useCamera } from '@features/camera/hooks/useCamera';
import { useDrawing } from '@features/camera/hooks/useDrawing';
import { useCameraStore } from '@features/camera/store/cameraStore';
import { useAuthStore } from '@features/auth/store/authStore';
import { Avatar } from '@components/ui/Avatar';
import { BottomNav } from '@components/ui/BottomNav';

const VERT_ACTIVATION = 28;
const VERT_COMMIT = 90;
const VERT_VELOCITY = 600;

const PINCH_SENSITIVITY = 0.35;

type ZoomPreset = 'half' | 'one' | 'five';

export function CameraMainPanel() {
  const router = useRouter();
  const { cameraRef, hasPermission, requestPermission, takePicture } = useCamera();
  const {
    facing,
    flash,
    zoom,
    captureState,
    capturedUri,
    drawingMode,
    toggleFacing,
    toggleFlash,
    setZoom,
    setDrawingMode,
    setCapturedUri,
    setCaptureState,
    reset,
  } = useCameraStore();
  const {
    completedPaths,
    activePath,
    startPath,
    addPoint,
    endPath,
    undo,
    canUndo,
    clear: clearDrawing,
  } = useDrawing();
  const profile = useAuthStore((s) => s.profile);

  const [zoomPreset, setZoomPreset] = useState<ZoomPreset>('one');

  const focusX = useSharedValue(0);
  const focusY = useSharedValue(0);
  const focusOpacity = useSharedValue(0);
  const focusRingStyle = useAnimatedStyle(() => ({
    opacity: focusOpacity.value,
    transform: [
      { translateX: focusX.value - 40 },
      { translateY: focusY.value - 40 },
    ],
  }));

  function triggerFocusIndicator(x: number, y: number) {
    'worklet';
    focusX.value = x;
    focusY.value = y;
    focusOpacity.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 600 }),
    );
  }

  const handleCapture = useCallback(async () => {
    if (captureState !== 'idle') return;
    const uri = await takePicture();
    if (!uri) return;
    setCapturedUri(uri);
    setCaptureState('captured');
  }, [captureState, takePicture, setCapturedUri, setCaptureState]);

  const handleDiscard = useCallback(() => {
    Alert.alert('Discard Snap?', 'Your snap will not be saved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          reset();
          clearDrawing();
        },
      },
    ]);
  }, [reset, clearDrawing]);

  const handleEnterEdit = useCallback(() => {
    setDrawingMode(true);
    setCaptureState('editing');
  }, [setDrawingMode, setCaptureState]);

  const handleExitEdit = useCallback(() => {
    setDrawingMode(false);
    setCaptureState('captured');
  }, [setDrawingMode, setCaptureState]);

  const openProfile = useCallback(() => router.push('/(app)/profile'), [router]);
  const openMemories = useCallback(() => router.push('/(app)/memories'), [router]);

  const applyZoomPreset = useCallback(
    (p: ZoomPreset) => {
      Haptics.selectionAsync();
      setZoomPreset(p);
      if (p === 'half') setZoom(0);
      else if (p === 'one') setZoom(0);
      else setZoom(ZOOM_CEILING);
    },
    [setZoom],
  );

  useEffect(() => {
    if (facing !== 'back') return;
    if (zoom >= ZOOM_CEILING * 0.7) setZoomPreset('five');
    else if (zoom > 0) setZoomPreset('one');
  }, [zoom, facing]);

  const pinchStartZoom = useSharedValue(0);
  const pinchGesture = Gesture.Pinch()
    .enabled(captureState === 'idle' && !drawingMode)
    .onStart(() => {
      'worklet';
      pinchStartZoom.value = zoom;
    })
    .onUpdate((e) => {
      'worklet';
      const delta = (e.scale - 1) * PINCH_SENSITIVITY;
      const next = Math.max(0, Math.min(ZOOM_CEILING, pinchStartZoom.value + delta));
      runOnJS(setZoom)(next);
    });

  const doubleTapGesture = Gesture.Tap()
    .enabled(captureState === 'idle' && !drawingMode)
    .numberOfTaps(2)
    .maxDelay(280)
    .onEnd((_e, success) => {
      'worklet';
      if (success) runOnJS(toggleFacing)();
    });

  const singleTapGesture = Gesture.Tap()
    .enabled(captureState === 'idle' && !drawingMode)
    .numberOfTaps(1)
    .maxDuration(220)
    .requireExternalGestureToFail(doubleTapGesture)
    .onEnd((e, success) => {
      'worklet';
      if (!success) return;
      triggerFocusIndicator(e.x, e.y);
    });

  const vertPan = Gesture.Pan()
    .enabled(captureState === 'idle' && !drawingMode)
    .activeOffsetY([-VERT_ACTIVATION, VERT_ACTIVATION])
    .failOffsetX([-VERT_ACTIVATION, VERT_ACTIVATION])
    .onEnd((e) => {
      'worklet';
      const ty = e.translationY;
      const vy = e.velocityY;
      if (ty < -VERT_COMMIT || vy < -VERT_VELOCITY) runOnJS(openMemories)();
      else if (ty > VERT_COMMIT || vy > VERT_VELOCITY) runOnJS(openProfile)();
    });

  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    vertPan,
    Gesture.Exclusive(doubleTapGesture, singleTapGesture),
  );

  if (!hasPermission) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-8">
        <Ionicons name="camera-outline" size={56} color="#FFFC00" />
        <Text className="text-white text-base text-center mt-4 mb-6">
          Camera access is required to take snaps.
        </Text>
        <Pressable
          onPress={requestPermission}
          className="bg-snap-yellow rounded-full px-8 py-3">
          <Text className="text-black font-bold">Allow Camera</Text>
        </Pressable>
      </View>
    );
  }

  const isPreview = captureState === 'captured' || captureState === 'editing';
  const isEditing = captureState === 'editing';
  const isBackCamera = facing === 'back';

  return (
    <View style={styles.container}>
      {!isPreview && (
        <GestureDetector gesture={composedGesture}>
          <View style={StyleSheet.absoluteFill}>
            <CameraViewComponent
              cameraRef={cameraRef}
              facing={facing}
              flash={flash}
              zoom={zoom}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.focusRing, focusRingStyle]}
            />
          </View>
        </GestureDetector>
      )}

      {isPreview && capturedUri && (
        <PreviewOverlay
          uri={capturedUri}
          facing={facing}
          completedPaths={isEditing ? [] : completedPaths}
          isEditing={isEditing}
          onClose={handleDiscard}
          onEnterEdit={handleEnterEdit}
          onExitEdit={handleExitEdit}
          onUndo={undo}
          canUndo={canUndo}
          drawingLayer={
            isEditing ? (
              <SkiaCanvas
                completedPaths={completedPaths}
                activePath={activePath}
                onTouchStart={startPath}
                onTouchMove={addPoint}
                onTouchEnd={endPath}
              />
            ) : null
          }
          topLayer={isEditing && drawingMode ? <DrawingToolbar /> : null}
        />
      )}

      {captureState === 'idle' && (
        <>
          <SafeAreaView style={styles.topLeft} pointerEvents="box-none">
            <Pressable onPress={openProfile} hitSlop={8}>
              <Avatar
                uri={profile?.avatar_url}
                name={profile?.display_name ?? '?'}
                size={36}
              />
            </Pressable>
          </SafeAreaView>

         
          <SafeAreaView style={styles.topRight} pointerEvents="box-none">
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Pressable
                  onPress={() => router.push('/(app)/search')}
                  className="w-10 h-10 rounded-full bg-black/40 items-center justify-center"
                  hitSlop={8}>
                  <Ionicons name="person-add" size={18} color="#fff" />
                </Pressable>
                <FlipButton onPress={toggleFacing} />
              </View>
              <View style={{ marginTop: 12 }}>
                <FlashControl flash={flash} onToggle={toggleFlash} />
              </View>
            </View>
          </SafeAreaView>

          {isBackCamera && (
            <View style={styles.zoomBar} pointerEvents="box-none">
              <ZoomBar
                zoom={zoom}
                preset={zoomPreset}
                onSelect={applyZoomPreset}
              />
            </View>
          )}

          <View style={styles.captureArea} pointerEvents="box-none">
            <CaptureButton onPress={handleCapture} />
          </View>

          <View style={styles.swipeUpHint} pointerEvents="none">
            <Ionicons name="chevron-up" size={20} color="rgba(255,255,255,0.6)" />
            <Text className="text-white/60 text-xs">Memories</Text>
          </View>

          <View style={styles.bottomNavWrap} pointerEvents="box-none">
            <BottomNav active="camera" />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topLeft: { position: 'absolute', top: 0, left: 16 },
  topRight: { position: 'absolute', top: 0, right: 16 },
  zoomBar: {
    position: 'absolute',
    bottom: 196,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureArea: {
    position: 'absolute',
    bottom: 110,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  swipeUpHint: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    alignItems: 'center',
  },
  bottomNavWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  focusRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: '#FFFC00',
  },
});
