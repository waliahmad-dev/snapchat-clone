import { useEffect, useState } from 'react';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';
import type { DbUser } from '@/types/database';

export function useProfile(userId?: string) {
  const currentUser = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const targetId = userId ?? currentUser?.id;
  const [profile, setLocalProfile] = useState<DbUser | null>(
    userId ? null : currentUser
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!targetId) return;
    if (!userId && currentUser) {
      setLocalProfile(currentUser);
      return;
    }
    load();
  }, [targetId]);

  async function load() {
    if (!targetId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', targetId)
        .single();
      setLocalProfile(data);
    } finally {
      setLoading(false);
    }
  }

  async function updateProfile(fields: Partial<Pick<DbUser, 'display_name' | 'avatar_url'>>) {
    if (!currentUser) return;
    const { data } = await supabase
      .from('users')
      .update(fields)
      .eq('id', currentUser.id)
      .select()
      .single();
    if (data) {
      setProfile(data);
      setLocalProfile(data);
    }
  }

  return { profile, loading, updateProfile, refresh: load };
}
