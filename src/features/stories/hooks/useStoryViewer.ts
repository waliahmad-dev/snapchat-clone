import { useState, useCallback, useRef } from 'react';
import type { StoryGroup } from './useStories';

export function useStoryViewer(group: StoryGroup, onClose: () => void) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const pauseRef = useRef(false);

  const currentStory = group.stories[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === group.stories.length - 1;

  const goNext = useCallback(() => {
    if (currentIndex < group.stories.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      onClose();
    }
  }, [currentIndex, group.stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  function pause() {
    pauseRef.current = true;
    setPaused(true);
  }

  function resume() {
    pauseRef.current = false;
    setPaused(false);
  }

  return {
    currentIndex,
    currentStory,
    isFirst,
    isLast,
    paused,
    goNext,
    goPrev,
    pause,
    resume,
  };
}
