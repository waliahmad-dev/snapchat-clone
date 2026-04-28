import 'react-native-url-polyfill/auto';
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from '@providers/AppProviders';
import { useAuth } from '@features/auth/hooks/useAuth';
import { useAuthStore } from '@features/auth/store/authStore';
import { useAppState } from '@hooks/useAppState';
import { useThemeColors } from '@lib/theme/useThemeColors';
import { useThemeStore } from '@lib/theme/themeStore';
import '../global.css';

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const { session, isInitialized } = useAuthStore();

  useAuth();
  useAppState();

  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (session && !inAppGroup) {
      router.replace('/(app)/camera');
    }
  }, [session, isInitialized, segments]);

  return null;
}

function ThemeBootstrap() {
  const hydrate = useThemeStore((s) => s.hydrate);
  const setSystemScheme = useThemeStore((s) => s.setSystemScheme);

  useEffect(() => {
    hydrate();
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === 'light' ? 'light' : 'dark');
    });
    return () => sub.remove();
  }, [hydrate, setSystemScheme]);

  return null;
}

function ThemedStatusBar() {
  const c = useThemeColors();
  return <StatusBar style={c.scheme === 'light' ? 'dark' : 'light'} />;
}

export default function RootLayout() {
  return (
    <AppProviders>
      <ThemeBootstrap />
      <AuthGate />
      <ThemedStatusBar />
      <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </AppProviders>
  );
}
