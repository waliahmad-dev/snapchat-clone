import { useEffect } from 'react';
import * as ScreenCapture from 'expo-screen-capture';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';

export function useScreenshotDetection(conversationId: string) {
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    if (!conversationId || !profile) return;

    const subscription = ScreenCapture.addScreenshotListener(async () => {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: profile.id,
        content: `${profile.display_name} took a screenshot 📸`,
        type: 'system',
      });
    });

    return () => subscription.remove();
  }, [conversationId, profile?.id]);
}
