import { useColorScheme } from 'react-native';

export type ThemeColors = {
  scheme: 'light' | 'dark';
  bg: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  danger: string;
  inputBg: string;
  iconCircleBg: string;
  rowPress: string;
};

const dark: ThemeColors = {
  scheme: 'dark',
  bg: '#000000',
  surface: '#0E0E10',
  surfaceElevated: '#1B1B1F',
  border: 'rgba(255,255,255,0.08)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.65)',
  textMuted: 'rgba(255,255,255,0.45)',
  accent: '#FFFC00',
  danger: '#FF453A',
  inputBg: '#1B1B1F',
  iconCircleBg: 'rgba(255,255,255,0.08)',
  rowPress: 'rgba(255,255,255,0.04)',
};

const light: ThemeColors = {
  scheme: 'light',
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#F5F5F7',
  border: 'rgba(0,0,0,0.08)',
  textPrimary: '#000000',
  textSecondary: 'rgba(0,0,0,0.6)',
  textMuted: 'rgba(0,0,0,0.4)',
  accent: '#FFCC00',
  danger: '#FF3B30',
  inputBg: '#F2F2F4',
  iconCircleBg: '#F2F2F4',
  rowPress: 'rgba(0,0,0,0.04)',
};

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'light' ? light : dark;
}
