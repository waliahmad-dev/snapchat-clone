import { useSharedValue, withSpring } from 'react-native-reanimated';
import { SCREEN_WIDTH } from '@constants/dimensions';
import type { SwipePanel } from '@/types/navigation';

const PANEL_INDEXES: Record<SwipePanel, number> = {
  chat: 0,
  camera: 1,
  stories: 2,
};
const MIN_INDEX = 0;
const MAX_INDEX = 2;

const SPRING_CONFIG = { damping: 30, stiffness: 260, mass: 0.6 };

function resolveInitialIndex(panel: SwipePanel | undefined): number {
  const idx = panel ? PANEL_INDEXES[panel] : undefined;
  if (idx === undefined || idx < MIN_INDEX || idx > MAX_INDEX) return 1;
  return idx;
}

export function useSwipeNavigation(initialPanel: SwipePanel = 'camera') {
  const initialIndex = resolveInitialIndex(initialPanel);
  const translateX = useSharedValue(-SCREEN_WIDTH * initialIndex);

  function snapToPanel(panel: SwipePanel) {
    const idx = resolveInitialIndex(panel);
    translateX.value = withSpring(-SCREEN_WIDTH * idx, SPRING_CONFIG);
  }

  function snapToIndex(index: number) {
    const clamped = Math.max(MIN_INDEX, Math.min(MAX_INDEX, Math.round(index)));
    translateX.value = withSpring(-SCREEN_WIDTH * clamped, SPRING_CONFIG);
  }

  return { translateX, snapToPanel, snapToIndex };
}
