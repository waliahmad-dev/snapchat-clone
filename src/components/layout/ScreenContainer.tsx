import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

interface Props {
  children: React.ReactNode;
  transparent?: boolean;
}

export function ScreenContainer({ children, transparent = false }: Props) {
  return (
    <SafeAreaView
      className={`flex-1 ${transparent ? 'bg-transparent' : 'bg-black'}`}
      edges={['top', 'bottom']}>
      <StatusBar style="light" />
      {children}
    </SafeAreaView>
  );
}
