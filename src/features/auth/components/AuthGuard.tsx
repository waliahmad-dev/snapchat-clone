import React from 'react';
import { useSegments, useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { LoadingSpinner } from '@components/ui/LoadingSpinner';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isInitialized, session } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  React.useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (session && inAuthGroup) {
      router.replace('/(app)/camera');
    }
  }, [isInitialized, session, segments]);

  if (!isInitialized) return <LoadingSpinner fullScreen />;

  return <>{children}</>;
}
