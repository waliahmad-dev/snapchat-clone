import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  FlatList,
  type ViewToken,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { differenceInDays, format } from 'date-fns';
import { supabase } from '@lib/supabase/client';
import { uploadToStorage } from '@lib/supabase/storage';
import { processImage } from '@lib/imageManipulator/processor';
import { useAuthStore } from '@features/auth/store/authStore';
import { RecipientSelector } from '@features/camera/components/RecipientSelector';
import type Memory from '@lib/watermelondb/models/Memory';
import { fullCacheKey, warmFullsAround } from '@features/memories/lib/memoryImageCache';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const DISMISS_DISTANCE = 140;
const DISMISS_VELOCITY = 850;

interface Props {
  memories: Memory[];
  initialIndex: number;
  resolveFullUrl: (memory: Memory) => Promise<string>;
  resolveLocalUri: (memory: Memory) => Promise<string>;
  onClose: () => void;
  onDelete: (memory: Memory) => void | Promise<void>;
}

export function MemoryViewer({
  memories,
  initialIndex,
  resolveFullUrl,
  resolveLocalUri,
  onClose,
  onDelete,
}: Props) {
  const profile = useAuthStore((s) => s.profile);
  const listRef = useRef<FlatList<Memory>>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [postingStory, setPostingStory] = useState(false);
  const [showRecipients, setShowRecipients] = useState(false);
  const [recipientUri, setRecipientUri] = useState<string | null>(null);

  const currentMemory = memories[currentIndex] ?? memories[0];

  const translateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(1);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const pagesStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const dismissGesture = Gesture.Pan()
    .activeOffsetY([-14, 14])
    .failOffsetX([-22, 22])
    .onUpdate((e) => {
      'worklet';
      translateY.value = e.translationY;
      backdropOpacity.value = Math.max(0.2, 1 - Math.abs(e.translationY) / (SCREEN_H * 0.9));
    })
    .onEnd((e) => {
      'worklet';
      const shouldDismiss =
        Math.abs(e.translationY) > DISMISS_DISTANCE || Math.abs(e.velocityY) > DISMISS_VELOCITY;

      if (shouldDismiss) {
        const direction = e.translationY >= 0 ? SCREEN_H : -SCREEN_H;
        translateY.value = withTiming(
          direction,
          { duration: 180, easing: Easing.in(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(onClose)();
          }
        );
        backdropOpacity.value = withTiming(0, { duration: 180 });
      } else {
        translateY.value = withTiming(0, { duration: 200 });
        backdropOpacity.value = withTiming(1, { duration: 200 });
      }
    });

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first && typeof first.index === 'number') setCurrentIndex(first.index);
  }).current;

  useEffect(() => {
    if (initialIndex > 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (memories.length === 0) {
      onClose();
    } else if (currentIndex >= memories.length) {
      setCurrentIndex(memories.length - 1);
      listRef.current?.scrollToIndex({
        index: memories.length - 1,
        animated: false,
      });
    }
  }, [memories.length, currentIndex, onClose]);

  useEffect(() => {
    warmFullsAround(memories, currentIndex, 1).catch(() => {});
  }, [memories, currentIndex]);

  const timestampLabel = useMemo(
    () => formatMemoryTimestamp(currentMemory?.createdAt),
    [currentMemory?.createdAt]
  );

  const handleDelete = useCallback(() => {
    Alert.alert('Delete memory?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await onDelete(currentMemory);
        },
      },
    ]);
  }, [currentMemory, onDelete]);

  const handleAddToStory = useCallback(async () => {
    if (!profile) return;
    setPostingStory(true);
    try {
      const localUri = await resolveLocalUri(currentMemory);
      const processed = await processImage(localUri);
      const storyPath = `${profile.id}/${Date.now()}_story.jpg`;
      await uploadToStorage('stories', storyPath, processed.full.uri);
      const { error } = await supabase.from('stories').insert({
        user_id: profile.id,
        media_url: storyPath,
      });
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Posted', 'Added to your story.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Please try again.';
      Alert.alert('Could not post', msg);
    } finally {
      setPostingStory(false);
    }
  }, [currentMemory, profile, resolveLocalUri]);

  const handleSendToFriends = useCallback(async () => {
    try {
      const local = await resolveLocalUri(currentMemory);
      setRecipientUri(local);
      setShowRecipients(true);
    } catch {
      Alert.alert('Not ready', 'Please try again in a moment.');
    }
  }, [currentMemory, resolveLocalUri]);

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <SafeAreaProvider>
        <View style={styles.root}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.bg, backdropStyle]} />

          <GestureDetector gesture={dismissGesture}>
            <Animated.View style={[StyleSheet.absoluteFill, pagesStyle]}>
              <FlatList
                ref={listRef}
                data={memories}
                keyExtractor={(m) => m.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={initialIndex}
                onViewableItemsChanged={onViewable}
                viewabilityConfig={{ itemVisiblePercentThreshold: 55 }}
                getItemLayout={(_, index) => ({
                  length: SCREEN_W,
                  offset: SCREEN_W * index,
                  index,
                })}
                renderItem={({ item }) => (
                  <MemoryPage memory={item} resolveFullUrl={resolveFullUrl} />
                )}
              />
            </Animated.View>
          </GestureDetector>

          <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
            <Pressable
              onPress={onClose}
              hitSlop={12}
              className="h-10 w-10 items-center justify-center rounded-full bg-black/50">
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
            <View style={styles.topCenter} pointerEvents="none">
              {timestampLabel && (
                <View style={styles.timestampPill}>
                  <Ionicons name="time-outline" size={12} color="#fff" />
                  <Text style={styles.timestampText}>{timestampLabel}</Text>
                </View>
              )}
              {memories.length > 1 && (
                <View style={styles.pageIndicator}>
                  <Text className="text-[11px] font-bold text-white">
                    {currentIndex + 1} / {memories.length}
                  </Text>
                </View>
              )}
            </View>
            <Pressable
              onPress={handleDelete}
              hitSlop={12}
              className="h-10 w-10 items-center justify-center rounded-full bg-black/50">
              <Ionicons name="trash-outline" size={20} color="#fff" />
            </Pressable>
          </SafeAreaView>

          <SafeAreaView edges={['bottom']} style={styles.bottomBar} pointerEvents="box-none">
            <View style={styles.actionRow}>
              <ActionPill
                icon="book-outline"
                label={postingStory ? 'Posting…' : 'My Story'}
                onPress={handleAddToStory}
                disabled={postingStory}
              />
              <ActionPill
                icon="paper-plane-outline"
                label="Send To"
                primary
                onPress={handleSendToFriends}
              />
            </View>
          </SafeAreaView>

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
      </SafeAreaProvider>
    </Modal>
  );
}

function MemoryPage({
  memory,
  resolveFullUrl,
}: {
  memory: Memory;
  resolveFullUrl: (m: Memory) => Promise<string>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    resolveFullUrl(memory)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        /* loader stays until cancelled/unmount */
      });
    return () => {
      cancelled = true;
    };
  }, [memory, resolveFullUrl]);

  return (
    <View style={styles.page}>
      {url && (
        <Image
          source={{ uri: url, cacheKey: fullCacheKey(memory) }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={150}
          recyclingKey={memory.id}
          onLoad={() => setReady(true)}
        />
      )}
      {!ready && (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#FFFC00" />
        </View>
      )}
    </View>
  );
}

function formatMemoryTimestamp(createdAt: number | undefined): string | null {
  if (!createdAt) return null;
  const days = differenceInDays(Date.now(), createdAt);
  if (days >= 7) {
    const sameYear = new Date(createdAt).getFullYear() === new Date().getFullYear();
    return format(createdAt, sameYear ? 'MMM d' : 'MMM d, yyyy');
  }
  return formatDistanceToNow(createdAt, { addSuffix: true });
}

function ActionPill({
  icon,
  label,
  primary = false,
  disabled = false,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center gap-2 rounded-full px-5 py-3 ${
        primary ? 'bg-snap-yellow' : 'bg-black/60'
      } ${disabled ? 'opacity-50' : ''}`}>
      <Ionicons name={icon} size={18} color={primary ? '#000' : '#fff'} />
      <Text className={`text-sm font-bold ${primary ? 'text-black' : 'text-white'}`}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bg: { backgroundColor: '#000' },
  page: { width: SCREEN_W, height: '100%' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loaderWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageIndicator: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  timestampPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  timestampText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
});
