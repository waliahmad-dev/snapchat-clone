import { create } from 'zustand';
import type { StoryWithUser } from '@/types/database';

interface StoriesState {
  stories: StoryWithUser[];
  viewedStoryIds: Set<string>;
  lastPostedAt: number;
}

interface StoriesActions {
  setStories: (stories: StoryWithUser[]) => void;
  markViewed: (storyId: string) => void;
  notifyPosted: () => void;
}

export const useStoriesStore = create<StoriesState & StoriesActions>()((set) => ({
  stories: [],
  viewedStoryIds: new Set(),
  lastPostedAt: 0,

  setStories: (stories) => set({ stories }),

  markViewed: (storyId) =>
    set((s) => ({
      viewedStoryIds: new Set([...s.viewedStoryIds, storyId]),
    })),

  notifyPosted: () => set({ lastPostedAt: Date.now() }),
}));
