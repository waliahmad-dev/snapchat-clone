import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Appearance } from 'react-native';
import type { ThemeScheme } from './useThemeColors';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'app:theme-mode';

interface ThemeState {
  mode: ThemeMode;
  systemScheme: ThemeScheme;
  hydrated: boolean;
}

interface ThemeActions {
  setMode: (mode: ThemeMode) => Promise<void>;
  setSystemScheme: (scheme: ThemeScheme) => void;
  hydrate: () => Promise<void>;
}

function readSystemScheme(): ThemeScheme {
  return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
}

export const useThemeStore = create<ThemeState & ThemeActions>()((set) => ({
  mode: 'system',
  systemScheme: readSystemScheme(),
  hydrated: false,

  setMode: async (mode) => {
    set({ mode });
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, mode);
    } catch {
    }
  },

  setSystemScheme: (systemScheme) => set({ systemScheme }),

  hydrate: async () => {
    let stored: ThemeMode = 'system';
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw === 'light' || raw === 'dark' || raw === 'system') stored = raw;
    } catch {
    }
    set({ mode: stored, systemScheme: readSystemScheme(), hydrated: true });
  },
}));

export function resolveActiveScheme(mode: ThemeMode, systemScheme: ThemeScheme): ThemeScheme {
  if (mode === 'system') return systemScheme;
  return mode;
}
