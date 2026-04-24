import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { DbUser } from '@/types/database';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: DbUser | null;
  isLoading: boolean;
  isInitialized: boolean;
}

interface AuthActions {
  setSession: (session: Session | null) => void;
  setProfile: (profile: DbUser | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  reset: () => void;
}

const initialState: AuthState = {
  session: null,
  user: null,
  profile: null,
  isLoading: false,
  isInitialized: false,
};

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  ...initialState,

  setSession: (session) =>
    set({ session, user: session?.user ?? null }),

  setProfile: (profile) => set({ profile }),

  setLoading: (isLoading) => set({ isLoading }),

  setInitialized: (isInitialized) => set({ isInitialized }),

  reset: () => set(initialState),
}));
