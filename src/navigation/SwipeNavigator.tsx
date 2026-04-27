import React, { createContext, useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SCREEN_WIDTH } from '@constants/dimensions';
import { useSwipeNavigation } from './useSwipeNavigation';
import { useCameraStore } from '@features/camera/store/cameraStore';
import { BottomNav } from '@components/ui/BottomNav';
import type { SwipePanel } from '@/types/navigation';

interface SwipeNavigatorContextValue {
  snapToPanel: (panel: SwipePanel) => void;
}
export const SwipeNavigatorContext = createContext<SwipeNavigatorContextValue>({
  snapToPanel: () => {},
});

interface Props {
  chatPanel: React.ReactNode;
  cameraPanel: React.ReactNode;
  storiesPanel: React.ReactNode;
}

const PANEL_COUNT = 3;
const DEFAULT_INDEX = 1;
const MIN_TRANSLATE = -SCREEN_WIDTH * (PANEL_COUNT - 1);
const MAX_TRANSLATE = 0;

const SPRING_CONFIG = { damping: 30, stiffness: 260, mass: 0.6 };
const VELOCITY_THRESHOLD = 500;

function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

export function SwipeNavigator({ chatPanel, cameraPanel, storiesPanel }: Props) {
  const { translateX, snapToPanel } = useSwipeNavigation('camera');
  const drawingMode = useCameraStore((s) => s.drawingMode);
  const captureState = useCameraStore((s) => s.captureState);

  // Lock horizontal swipes whenever the user is reviewing or annotating a
  // capture — the preview owns the screen at that point; sliding to chat or
  // stories mid-review would discard unsent work and is always a misclick.
  const navLocked = drawingMode || captureState !== 'idle';

  const [activePanel, setActivePanel] = useState<SwipePanel>('camera');

  useAnimatedReaction(
    () => Math.round(-translateX.value / SCREEN_WIDTH),
    (currentIdx, previousIdx) => {
      if (currentIdx === previousIdx) return;
      const panel: SwipePanel =
        currentIdx === 0 ? 'chat' : currentIdx === 2 ? 'stories' : 'camera';
      runOnJS(setActivePanel)(panel);
    },
  );

  const startX = useSharedValue(-SCREEN_WIDTH * DEFAULT_INDEX);

  const panGesture = Gesture.Pan()
    .enabled(!navLocked)
    .activeOffsetX([-18, 18])
    .failOffsetY([-18, 18])
    .onBegin(() => {
      'worklet';
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      'worklet';
      const proposed = startX.value + e.translationX;
      translateX.value = clamp(proposed, MIN_TRANSLATE, MAX_TRANSLATE);
    })
    .onEnd((e) => {
      'worklet';
      const startIndex = Math.round(-startX.value / SCREEN_WIDTH);
      const currentIndex = -translateX.value / SCREEN_WIDTH;

      let targetIndex: number;

      if (Math.abs(e.velocityX) > VELOCITY_THRESHOLD) {
        targetIndex = e.velocityX > 0 ? startIndex - 1 : startIndex + 1;
      } else {
        targetIndex = Math.round(currentIndex);
      }

      const clampedIndex = clamp(targetIndex, 0, PANEL_COUNT - 1);
      translateX.value = withSpring(-SCREEN_WIDTH * clampedIndex, SPRING_CONFIG);
    });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: clamp(translateX.value, MIN_TRANSLATE, MAX_TRANSLATE) },
    ],
  }));

  return (
    <SwipeNavigatorContext.Provider value={{ snapToPanel }}>
      <View style={styles.root}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.container, containerStyle]}>
            <View style={[styles.panel, { left: 0 }]}>{chatPanel}</View>
            <View style={[styles.panel, { left: SCREEN_WIDTH }]}>{cameraPanel}</View>
            <View style={[styles.panel, { left: 2 * SCREEN_WIDTH }]}>{storiesPanel}</View>
          </Animated.View>
        </GestureDetector>

        {!navLocked && (
          <View style={styles.bottomNav} pointerEvents="box-none">
            <BottomNav active={activePanel} />
          </View>
        )}
      </View>
    </SwipeNavigatorContext.Provider>
  );
}

export function useSwipeNavigator() {
  return useContext(SwipeNavigatorContext);
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    width: PANEL_COUNT * SCREEN_WIDTH,
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
