import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as Localization from 'expo-localization';
import i18n, { isSupportedLocale, type Locale } from './index';

const STORAGE_KEY = 'app:locale';

interface LocaleState {
  locale: Locale;
  hydrated: boolean;
}

interface LocaleActions {
  setLocale: (locale: Locale) => Promise<void>;
  hydrate: () => Promise<void>;
}

function detectDeviceLocale(): Locale {
  try {
    const code = Localization.getLocales()[0]?.languageCode;
    if (isSupportedLocale(code)) return code;
  } catch {
  }
  return 'en';
}

export const useLocaleStore = create<LocaleState & LocaleActions>()((set) => ({
  locale: 'en',
  hydrated: false,

  setLocale: async (locale) => {
    set({ locale });
    try {
      await i18n.changeLanguage(locale);
    } catch {
    }
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, locale);
    } catch {
    }
  },

  hydrate: async () => {
    let stored: Locale | null = null;
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (isSupportedLocale(raw)) stored = raw;
    } catch {
    }
    const resolved = stored ?? detectDeviceLocale();
    try {
      await i18n.changeLanguage(resolved);
    } catch {
    }
    set({ locale: resolved, hydrated: true });
  },
}));
