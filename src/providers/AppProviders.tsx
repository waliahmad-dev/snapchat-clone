import '@lib/i18n';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WatermelonProvider } from './WatermelonProvider';
import { QueryProvider } from './QueryProvider';
import { SupabaseProvider } from './SupabaseProvider';
import { NotificationProvider } from './NotificationProvider';
import { OfflineProvider } from './OfflineProvider';

interface Props {
  children: React.ReactNode;
}

export function AppProviders({ children }: Props) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SupabaseProvider>
          <QueryProvider>
            <WatermelonProvider>
              <OfflineProvider>
                <NotificationProvider>{children}</NotificationProvider>
              </OfflineProvider>
            </WatermelonProvider>
          </QueryProvider>
        </SupabaseProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
