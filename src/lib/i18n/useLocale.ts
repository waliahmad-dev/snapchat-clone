import { useLocaleStore } from './localeStore';
import { SUPPORTED_LOCALES, type Locale } from './index';

export const LANGUAGE_LABEL: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
};

export const LANGUAGE_FLAG: Record<Locale, string> = {
  en: '🇬🇧',
  fr: '🇫🇷',
  es: '🇪🇸',
};

export function useLocale() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  return { locale, setLocale, supportedLocales: SUPPORTED_LOCALES };
}
