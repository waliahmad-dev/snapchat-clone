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
import { useAuthStore } from '@features/auth/store/authStore';
import type { StoryGroup } from '../hooks/useStories';
import type { DbUser } from '@/types/database';

const { height: SCREEN_H } = Dimensions.get('window');
const STORY_DURATION_MS = 5000;
const VIEWERS_PANEL_HEIGHT = SCREEN_H * 0.65;

interface Props {
  storyGroup: StoryGroup;
  onClose: () => void;
  onRecordView: (storyId: string) => void;
}

type ViewerRow = {
  viewer_id: string;
  viewed_at: string;
  user?: DbUser;
};

export function StoryViewer({ storyGroup, onClose, onRecordView }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [urlCache, setUrlCache] = useState<Record<string, string>>({});
  const [viewers, setViewers] = useState<ViewerRow[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const hasFetchedRef = useRef<Set<string>>(new Set()); // avoid refetches per story

  const currentStory = storyGroup.stories[currentIndex];
  const isOwn = storyGroup.user.id === profile?.id;

  const [panelOpen, setPanelOpen] = useState(false);
  const panelOpenSV = useSharedValue(0); // 1 when open, 0 when closed (worklet-readable)

  useEffect(() => {
    loadUrl(currentStory.media_url);
    onRecordView(currentStory.id);
    setViewers([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

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
      const { data: users } = await supabase
        .from('users')
        .select('*')
        .in('id', ids);
      const userMap = new Map((users ?? []).map((u: DbUser) => [u.id, u]));

      setViewers(
        views.map((v: { viewer_id: string; viewed_at: string }) => ({
          viewer_id: v.viewer_id,
          viewed_at: v.viewed_at,
          user: userMap.get(v.viewer_id),
        })),
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
          await supabase
            .from('stories')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', currentStory.id);
          onClose();
        },
      },
    ]);
  }

  const swipeDownToClose = Gesture.Pan()
    .onEnd((e) => {
      'worklet';
      if (e.translationY > 100 && Math.abs(e.translationX) < 80) {
        // Tiered dismiss: if the viewers panel is up, the first swipe-down
        // collapses the panel only; a second swipe-down then closes the story.
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
        backdropOpacity.value = Math.max(
          0,
          0.55 - e.translationY / VIEWERS_PANEL_HEIGHT,
        );
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

  const storyGestures = useMemo(
    () => Gesture.Race(swipeDownToClose, swipeUpToOpenPanel),
    [swipeDownToClose, swipeUpToOpenPanel],
  );

  const currentUrl = urlCache[currentStory?.media_url];
  const viewCount = currentStory?.story_views?.length ?? 0;

  return (
    <View style={StyleSheet.absoluteFill} className="bg-black">
      <GestureDetector gesture={storyGestures}>
        <View style={StyleSheet.absoluteFill}>
          {currentUrl ? (
            <Image
              source={{ uri: currentUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <View style={StyleSheet.absoluteFill} className="bg-snap-surface" />
          )}

          <View style={styles.tapZones} pointerEvents="box-none">
            <Pressable style={{ flex: 0.35, height: '100%' }} onPress={goPrev} />
            <Pressable style={{ flex: 0.65, height: '100%' }} onPress={goNext} />
          </View>
        </View>
      </GestureDetector>

      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        <StoryProgressBar
          count={storyGroup.stories.length}
          currentIndex={currentIndex}
          duration={STORY_DURATION_MS}
          onComplete={goNext}
        />

        <View className="flex-row items-center justify-between px-3 pt-2">
          <View className="flex-row items-center gap-2 flex-1">
            <Avatar
              uri={storyGroup.user.avatar_url ?? null}
              name={storyGroup.user.display_name}
              size={32}
            />
            <Text className="text-white font-semibold text-sm" numberOfLines={1}>
              {storyGroup.user.display_name}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            {isOwn && (
              <Pressable
                onPress={handleDeleteStory}
                hitSlop={8}
                className="w-9 h-9 rounded-full bg-black/40 items-center justify-center">
                <Ionicons name="trash-outline" size={18} color="#fff" />
              </Pressable>
            )}
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="w-9 h-9 rounded-full bg-black/40 items-center justify-center">
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
            className="flex-row items-center bg-black/50 rounded-full px-4 py-2 gap-1">
            <Ionicons name="chevron-up" size={14} color="#fff" />
            <Ionicons name="eye-outline" size={15} color="#fff" style={{ marginLeft: 2 }} />
            <Text className="text-white font-semibold text-sm ml-1">
              {viewCount}
            </Text>
          </Pressable>
        </SafeAreaView>
      )}

      <Animated.View
        pointerEvents="none"
        style={[styles.backdrop, backdropStyle]}
      />
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
            }),
          )}>
          <View style={styles.backdropTouchable} />
        </GestureDetector>
      )}

      <GestureDetector gesture={panelDismissGesture}>
        <Animated.View style={[styles.panel, panelStyle]}>
          <View style={styles.panelHandle} />
          <Text className="text-black font-bold text-base px-4 pt-1 pb-3">
            Viewed by {viewers.length}
          </Text>

          {viewersLoading ? (
            <Text className="text-gray-500 text-sm text-center py-6">
              Loading viewers…
            </Text>
          ) : viewers.length === 0 ? (
            <Text className="text-gray-500 text-sm text-center py-6">
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
                  <View className="flex-1 ml-3">
                    <Text className="text-black font-semibold" numberOfLines={1}>
                      {item.user?.display_name ?? 'Unknown'}
                    </Text>
                    {item.user?.username && (
                      <Text className="text-gray-500 text-xs" numberOfLines={1}>
                        @{item.user.username}
                      </Text>
                    )}
                  </View>
                  <Text className="text-gray-400 text-xs ml-2">
                    {formatDistanceToNow(new Date(item.viewed_at), {
                      addSuffix: false,
                    })}
                  </Text>
                </View>
              )}
              ItemSeparatorComponent={() => (
                <View className="h-px bg-gray-100 ml-16" />
              )}
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
  tapZones: {
    position: 'absolute',
    top: 100,
    bottom: 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
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
