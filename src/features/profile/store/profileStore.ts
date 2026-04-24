import { create } from 'zustand';
import type { DbUser } from '@/types/database';

interface ProfileState {
  viewedProfile: DbUser | null;
  setViewedProfile: (profile: DbUser | null) => void;
}

export const useProfileStore = create<ProfileState>()((set) => ({
  viewedProfile: null,
  setViewedProfile: (viewedProfile) => set({ viewedProfile }),
}));
