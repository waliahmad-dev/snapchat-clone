import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  children: React.ReactNode;
  transparent?: boolean;
  /** Force a fixed background (e.g. media screens that must stay dark). */
  background?: string;
}

export function ScreenContainer({ children, transparent = false, background }: Props) {
  const c = useThemeColors();
  const bg = transparent ? 'transparent' : (background ?? c.bg);
  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: bg }} edges={['top', 'bottom']}>
      <StatusBar style={c.scheme === 'light' && !background ? 'dark' : 'light'} />
      {children}
    </SafeAreaView>
  );
}
