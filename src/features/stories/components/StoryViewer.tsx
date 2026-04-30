import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Image,
  Pressable,
  Text,
  Alert,
  StyleSheet,
  Dimensions,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { StoryProgressBar } from './StoryProgressBar';
import { getSignedUrl } from '@lib/supabase/storage';
import { supabase } from '@lib/supabase/client';
import { Avatar } from '@components/ui/Avatar';
import { PulsingLoader } from '@components/ui/PulsingLoader';
import { useAuthStore } from '@features/auth/store/authStore';
import type { StoryGroup } from '../hooks/useStories';
import type { DbUser } from '@/types/database';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const STORY_DURATION_MS = 5000;
const VIEWERS_PANEL_HEIGHT = SCREEN_H * 0.65;

interface Props {
  storyGroup: StoryGroup;
  onClose: () => void;
  onRecordView: (storyId: string) => void;
  onStoryDeleted?: () => void;
}

type ViewerRow = {
  viewer_id: string;
  viewed_at: string;
  user?: DbUser;
};

export function StoryViewer({ storyGroup, onClose, onRecordView, onStoryDeleted }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [urlCache, setUrlCache] = useState<Record<string, string>>({});
  const [viewers, setViewers] = useState<ViewerRow[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [imageError, setImageError] = useState(false);
  const hasFetchedRef = useRef<Set<string>>(new Set());

  const currentStory = storyGroup.stories[currentIndex];
  const isOwn = storyGroup.user.id === profile?.id;

  const [panelOpen, setPanelOpen] = useState(false);
  const panelOpenSV = useSharedValue(0);

  useEffect(() => {
    setImageReady(false);
    setImageError(false);
    loadUrl(currentStory.media_url);
    if (!isOwn) onRecordView(currentStory.id);
    setViewers([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  useEffect(() => {
    if (!isOwn || !currentStory) return;
    const sub = supabase
      .channel(`story_views:${currentStory.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'story_views',
          filter: `story_id=eq.${currentStory.id}`,
        },
        () => {
          if (hasFetchedRef.current.has(currentStory.id)) {
            fetchViewers();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStory?.id, isOwn]);

  async function loadUrl(path: string) {
    if (urlCache[path]) return;
    const url = await getSignedUrl('stories', path);
    setUrlCache((prev) => ({ ...prev, [path]: url }));
  }

  const panelY = useSharedValue(VIEWERS_PANEL_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: panelY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const openPanel = useCallback(() => {
    setPanelOpen(true);
    panelOpenSV.value = 1;
    panelY.value = withTiming(0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
    backdropOpacity.value = withTiming(0.55, { duration: 260 });
    if (isOwn && !hasFetchedRef.current.has(currentStory.id)) {
      hasFetchedRef.current.add(currentStory.id);
      fetchViewers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStory?.id, isOwn]);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    panelOpenSV.value = 0;
    panelY.value = withTiming(VIEWERS_PANEL_HEIGHT, {
      duration: 220,
      easing: Easing.in(Easing.cubic),
    });
    backdropOpacity.value = withTiming(0, { duration: 220 });
  }, [panelY, backdropOpacity, panelOpenSV]);

  async function fetchViewers() {
    if (!currentStory) return;
    setViewersLoading(true);
    try {
      const { data: views } = await supabase
        .from('story_views')
        .select('viewer_id, viewed_at')
        .eq('story_id', currentStory.id)
        .order('viewed_at', { ascending: false });

      if (!views) {
        setViewers([]);
        return;
      }
      const ids = views.map((v: { viewer_id: string }) => v.viewer_id);
      const { data: users } = await supabase.from('users').select('*').in('id', ids);
      const userMap = new Map((users ?? []).map((u: DbUser) => [u.id, u]));

      setViewers(
        views.map((v: { viewer_id: string; viewed_at: string }) => ({
          viewer_id: v.viewer_id,
          viewed_at: v.viewed_at,
          user: userMap.get(v.viewer_id),
        }))
      );
    } finally {
      setViewersLoading(false);
    }
  }

  const goNext = useCallback(() => {
    if (currentIndex < storyGroup.stories.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      onClose();
    }
  }, [currentIndex, storyGroup.stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }, [currentIndex]);

  async function handleDeleteStory() {
    Alert.alert('Delete Story?', 'This story will be removed from your profile.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('stories')
            .delete()
            .eq('id', currentStory.id);
          if (error) {
            Alert.alert('Could not delete story', error.message);
            return;
          }
          onStoryDeleted?.();
          onClose();
        },
      },
    ]);
  }

  const swipeDownToClose = Gesture.Pan().onEnd((e) => {
    'worklet';
    if (e.translationY > 100 && Math.abs(e.translationX) < 80) {
      if (panelOpenSV.value === 1) return;
      runOnJS(onClose)();
    }
  });

  const swipeUpToOpenPanel = Gesture.Pan()
    .enabled(isOwn)
    .onEnd((e) => {
      'worklet';
      if (panelOpenSV.value === 1) return;
      if (e.translationY < -80 || e.velocityY < -700) {
        runOnJS(openPanel)();
      }
    });

  const panelDismissGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onUpdate((e) => {
      'worklet';
      if (e.translationY > 0) {
        panelY.value = e.translationY;
        backdropOpacity.value = Math.max(0, 0.55 - e.translationY / VIEWERS_PANEL_HEIGHT);
      }
    })
    .onEnd((e) => {
      'worklet';
      if (e.translationY > 90 || e.velocityY > 700) {
        runOnJS(closePanel)();
      } else {
        panelY.value = withTiming(0, { duration: 180 });
        backdropOpacity.value = withTiming(0.55, { duration: 180 });
      }
    });

  const tapNav = Gesture.Tap()
    .maxDuration(220)
    .onEnd((e, success) => {
      'worklet';
      if (!success) return;
      if (e.x < SCREEN_W * 0.35) runOnJS(goPrev)();
      else runOnJS(goNext)();
    });

  const holdPause = Gesture.LongPress()
    .minDuration(180)
    .maxDistance(20)
    .onStart(() => {
      'worklet';
      runOnJS(setPaused)(true);
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(setPaused)(false);
    });

  const storyGestures = useMemo(
    () => Gesture.Race(swipeDownToClose, swipeUpToOpenPanel, Gesture.Exclusive(holdPause, tapNav)),
    [swipeDownToClose, swipeUpToOpenPanel, holdPause, tapNav]
  );

  const currentUrl = urlCache[currentStory?.media_url];
  const viewCount = currentStory?.story_views?.length ?? 0;

  return (
    <View style={StyleSheet.absoluteFill} className="bg-black">
      <GestureDetector gesture={storyGestures}>
        <View style={StyleSheet.absoluteFill}>
          {currentUrl && !imageError ? (
            <Image
              source={{ uri: currentUrl }}
              style={[StyleSheet.absoluteFill, { opacity: imageReady ? 1 : 0 }]}
              resizeMode="cover"
              onLoad={() => setImageReady(true)}
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={StyleSheet.absoluteFill} className="bg-snap-surface" />
          )}
          {!imageReady && !imageError && <PulsingLoader label="Loading story…" />}
          {imageError && (
            <View style={StyleSheet.absoluteFill} className="items-center justify-center">
              <Ionicons name="alert-circle-outline" size={48} color="#fff" />
              <Text className="mt-2 text-white">Story couldn't load</Text>
            </View>
          )}
        </View>
      </GestureDetector>

      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        <StoryProgressBar
          count={storyGroup.stories.length}
          currentIndex={currentIndex}
          duration={STORY_DURATION_MS}
          paused={paused || panelOpen || !imageReady}
          onComplete={goNext}
        />

        <View className="flex-row items-center justify-between px-3 pt-2">
          <View className="flex-1 flex-row items-center gap-2">
            <Avatar
              uri={storyGroup.user.avatar_url ?? null}
              name={storyGroup.user.display_name}
              size={32}
            />
            <Text className="text-sm font-semibold text-white" numberOfLines={1}>
              {storyGroup.user.display_name}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            {isOwn && (
              <Pressable
                onPress={handleDeleteStory}
                hitSlop={8}
                className="h-9 w-9 items-center justify-center rounded-full bg-black/40">
                <Ionicons name="trash-outline" size={18} color="#fff" />
              </Pressable>
            )}
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-full bg-black/40">
              <Ionicons name="close" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {isOwn && (
        <SafeAreaView edges={['bottom']} style={styles.bottomHint} pointerEvents="box-none">
          <Pressable
            onPress={openPanel}
            hitSlop={8}
            className="flex-row items-center gap-1 rounded-full bg-black/50 px-4 py-2">
            <Ionicons name="chevron-up" size={14} color="#fff" />
            <Ionicons name="eye-outline" size={15} color="#fff" style={{ marginLeft: 2 }} />
            <Text className="ml-1 text-sm font-semibold text-white">{viewCount}</Text>
          </Pressable>
        </SafeAreaView>
      )}

      <Animated.View pointerEvents="none" style={[styles.backdrop, backdropStyle]} />
      {panelOpen && (
        <GestureDetector
          gesture={Gesture.Exclusive(
            Gesture.Tap().onEnd(() => {
              'worklet';
              runOnJS(closePanel)();
            }),
            Gesture.Pan().onEnd((e) => {
              'worklet';
              if (e.translationY > 50 || e.velocityY > 600) {
                runOnJS(closePanel)();
              }
            })
          )}>
          <View style={styles.backdropTouchable} />
        </GestureDetector>
      )}

      <GestureDetector gesture={panelDismissGesture}>
        <Animated.View style={[styles.panel, panelStyle]}>
          <View style={styles.panelHandle} />
          <Text className="px-4 pb-3 pt-1 text-base font-bold text-black">
            Viewed by {viewers.length}
          </Text>

          {viewersLoading ? (
            <Text className="py-6 text-center text-sm text-gray-500">Loading viewers…</Text>
          ) : viewers.length === 0 ? (
            <Text className="py-6 text-center text-sm text-gray-500">
              No one has viewed this yet.
            </Text>
          ) : (
            <FlatList
              data={viewers}
              keyExtractor={(v) => v.viewer_id}
              renderItem={({ item }) => (
                <View className="flex-row items-center px-4 py-2.5">
                  <Avatar
                    uri={item.user?.avatar_url ?? null}
                    name={item.user?.display_name ?? '?'}
                    size={40}
                  />
                  <View className="ml-3 flex-1">
                    <Text className="font-semibold text-black" numberOfLines={1}>
                      {item.user?.display_name ?? 'Unknown'}
                    </Text>
                    {item.user?.username && (
                      <Text className="text-xs text-gray-500" numberOfLines={1}>
                        @{item.user.username}
                      </Text>
                    )}
                  </View>
                  <Text className="ml-2 text-xs text-gray-400">
                    {formatDistanceToNow(new Date(item.viewed_at), {
                      addSuffix: false,
                    })}
                  </Text>
                </View>
              )}
              ItemSeparatorComponent={() => <View className="ml-16 h-px bg-gray-100" />}
            />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomHint: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  backdropTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: VIEWERS_PANEL_HEIGHT,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  panelHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D1D6',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
});
