import { create } from 'zustand';
import type { StoryWithUser } from '@/types/database';

interface StoriesState {
  stories: StoryWithUser[];
  viewedStoryIds: Set<string>;
}

interface StoriesActions {
  setStories: (stories: StoryWithUser[]) => void;
  markViewed: (storyId: string) => void;
}

export const useStoriesStore = create<StoriesState & StoriesActions>()((set) => ({
  stories: [],
  viewedStoryIds: new Set(),

  setStories: (stories) => set({ stories }),

  markViewed: (storyId) =>
    set((s) => ({
      viewedStoryIds: new Set([...s.viewedStoryIds, storyId]),
    })),
}));
