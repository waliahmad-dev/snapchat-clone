import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { supabase } from '@lib/supabase/client';

export function useAppState() {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (prev.match(/inactive|background/) && nextState === 'active') {
        supabase.realtime.connect();
      } else if (nextState.match(/inactive|background/)) {
        supabase.realtime.disconnect();
      }
    });

    return () => subscription.remove();
  }, []);
}
