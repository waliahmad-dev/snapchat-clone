import { useEffect } from 'react';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const { setSession, setProfile, setInitialized } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data);
  }
}

export function useSession() {
  return useAuthStore((s) => s.session);
}

export function useCurrentUser() {
  return useAuthStore((s) => s.profile);
}
