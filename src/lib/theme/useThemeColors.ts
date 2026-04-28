import { useColorScheme } from 'react-native';
import { useThemeStore, resolveActiveScheme } from './themeStore';

export type ThemeScheme = 'light' | 'dark';

export type ThemeColors = {
  scheme: ThemeScheme;

  bg: string;
  surface: string;
  surfaceElevated: string;
  surfaceSubtle: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  border: string;
  divider: string;

  accent: string;
  accentText: string;
  danger: string;
  success: string;
  info: string;

  inputBg: string;
  placeholder: string;

  iconCircleBg: string;
  rowPress: string;
  overlay: string;
  scrim: string;

  icon: string;
  iconMuted: string;

  bubbleSelf: string;
  bubbleOther: string;
  bubbleSelfText: string;
  bubbleOtherText: string;
};

const dark: ThemeColors = {
  scheme: 'dark',

  bg: '#000000',
  surface: '#0E0E10',
  surfaceElevated: '#1B1B1F',
  surfaceSubtle: 'rgba(255,255,255,0.06)',

  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.65)',
  textMuted: 'rgba(255,255,255,0.45)',
  textInverse: '#000000',

  border: 'rgba(255,255,255,0.08)',
  divider: 'rgba(255,255,255,0.06)',

  accent: '#FFFC00',
  accentText: '#000000',
  danger: '#FF453A',
  success: '#34C759',
  info: '#0A84FF',

  inputBg: '#1B1B1F',
  placeholder: 'rgba(255,255,255,0.35)',

  iconCircleBg: 'rgba(255,255,255,0.08)',
  rowPress: 'rgba(255,255,255,0.04)',
  overlay: 'rgba(0,0,0,0.6)',
  scrim: 'rgba(0,0,0,0.4)',

  icon: '#FFFFFF',
  iconMuted: 'rgba(255,255,255,0.55)',

  bubbleSelf: '#FFFC00',
  bubbleOther: '#1B1B1F',
  bubbleSelfText: '#000000',
  bubbleOtherText: '#FFFFFF',
};

const light: ThemeColors = {
  scheme: 'light',

  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#F2F2F7',
  surfaceSubtle: 'rgba(0,0,0,0.04)',

  textPrimary: '#000000',
  textSecondary: 'rgba(0,0,0,0.6)',
  textMuted: 'rgba(0,0,0,0.4)',
  textInverse: '#FFFFFF',

  border: 'rgba(0,0,0,0.08)',
  divider: 'rgba(0,0,0,0.06)',

  accent: '#FFFC00',
  accentText: '#000000',
  danger: '#FF3B30',
  success: '#34C759',
  info: '#007AFF',

  inputBg: '#F2F2F7',
  placeholder: 'rgba(0,0,0,0.35)',

  iconCircleBg: '#F2F2F7',
  rowPress: 'rgba(0,0,0,0.04)',
  overlay: 'rgba(0,0,0,0.5)',
  scrim: 'rgba(0,0,0,0.3)',

  icon: '#111111',
  iconMuted: 'rgba(0,0,0,0.5)',

  bubbleSelf: '#FFFC00',
  bubbleOther: '#F2F2F7',
  bubbleSelfText: '#000000',
  bubbleOtherText: '#000000',
};

export function getThemeColors(scheme: ThemeScheme | null | undefined): ThemeColors {
  return scheme === 'light' ? light : dark;
}

/**
 * Returns the active theme palette.
 *
 * Resolution order: persisted user choice ('light' | 'dark') wins over the OS
 * scheme. When the user picks 'system' (the default), we follow the OS via
 * `useColorScheme`, which re-renders on appearance changes — so toggling Light
 * Mode in iOS/Android Settings updates the app live.
 */
export function useThemeColors(): ThemeColors {
  const systemScheme = useColorScheme();
  const mode = useThemeStore((s) => s.mode);
  const resolvedSystem: ThemeScheme = systemScheme === 'light' ? 'light' : 'dark';
  const active = resolveActiveScheme(mode, resolvedSystem);
  return active === 'light' ? light : dark;
}
