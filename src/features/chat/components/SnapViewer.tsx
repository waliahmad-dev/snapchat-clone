import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Image,
  Pressable,
  StyleSheet,
  Text,
  Alert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { getSignedUrl } from '@lib/supabase/storage';

const DURATION_MS = 15_000;

interface Props {
  mediaPath: string;
  preloadedUrl?: string | null;
  isOwn: boolean;
  alreadySaved: boolean;
  onClose: (savedInSession: boolean) => void;
  onSave: () => void;
  onUnsave: () => void;
}

export function SnapViewer({
  mediaPath,
  preloadedUrl,
  isOwn,
  alreadySaved,
  onClose,
  onSave,
  onUnsave,
}: Props) {
  const [url, setUrl] = useState<string | null>(preloadedUrl ?? null);
  const [imageReady, setImageReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saved, setSaved] = useState(alreadySaved);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progress = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const pulse = useSharedValue(0.4);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (preloadedUrl) {
      setUrl(preloadedUrl);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const u = await getSignedUrl('snaps', mediaPath);
        if (!cancelled) setUrl(u);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [preloadedUrl, mediaPath]);

  useEffect(() => {
    if (!imageReady) return;
    progress.value = withTiming(1, { duration: DURATION_MS });
    timerRef.current = setTimeout(() => {
      close();
    }, DURATION_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageReady]);

  function close() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onClose(saved);
  }

  async function handleLongPress() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (saved) {
      Alert.alert(
        'Unsave?',
        "If you unsave, it'll be removed from the chat.",
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unsave',
            style: 'destructive',
            onPress: () => {
              setSaved(false);
              onUnsave();
              close();
            },
          },
        ],
      );
    } else {
      Alert.alert('Save this snap?', 'Both of you will see that it was saved.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save in chat',
          onPress: () => {
            setSaved(true);
            onSave();
          },
        },
      ]);
    }
  }

  const showLoader = !imageReady && !loadError;

  return (
    <Modal visible animationType="fade" statusBarTranslucent presentationStyle="fullScreen">
      <SafeAreaProvider>
      <Pressable
        onPress={close}
        onLongPress={handleLongPress}
        delayLongPress={350}
        style={styles.root}>
        {url && !loadError && (
          <Image
            source={{ uri: url }}
            style={[StyleSheet.absoluteFill, { opacity: imageReady ? 1 : 0 }]}
            resizeMode="contain"
            onLoad={() => setImageReady(true)}
            onError={() => setLoadError(true)}
          />
        )}

        {showLoader && (
          <View style={styles.loaderWrap}>
            <View style={styles.loaderDot}>
              <Animated.View style={[styles.loaderCore, pulseStyle]} />
            </View>
            <Animated.Text style={[styles.loaderText, pulseStyle]}>
              Loading snap…
            </Animated.Text>
          </View>
        )}

        {loadError && (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={48} color="#fff" />
            <Text className="text-white mt-2">Snap couldn't load</Text>
          </View>
        )}

        <SafeAreaView edges={['top']} pointerEvents="box-none">
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressStyle]} />
          </View>

          <View style={styles.topRow} pointerEvents="box-none">
            <Pressable
              onPress={close}
              hitSlop={12}
              className="w-10 h-10 rounded-full bg-black/50 items-center justify-center">
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>

            {saved && (
              <View className="flex-row items-center bg-black/60 rounded-full px-3 py-1 gap-1">
                <Ionicons name="bookmark" size={14} color="#FFFC00" />
                <Text className="text-snap-yellow font-bold text-xs">SAVED</Text>
              </View>
            )}
          </View>
        </SafeAreaView>

        <SafeAreaView edges={['bottom']} style={styles.bottomHint} pointerEvents="none">
          <Text className="text-white/70 text-xs">
            {isOwn
              ? 'Your snap'
              : saved
                ? 'Long-press to unsave'
                : 'Long-press to save · Tap to close'}
          </Text>
        </SafeAreaView>
      </Pressable>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  centered: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginHorizontal: 12,
    marginTop: 6,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFC00',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  bottomHint: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  loaderWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loaderDot: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: 'rgba(255,252,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderCore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFC00',
  },
  loaderText: {
    color: '#FFFC00',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
