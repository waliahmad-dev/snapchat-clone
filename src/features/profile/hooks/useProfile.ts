import { useEffect, useId, useState } from 'react';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';
import type { DbUser } from '@/types/database';

export function useProfile(userId?: string) {
  const currentUser = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const targetId = userId ?? currentUser?.id;
  const isOwn = !userId || userId === currentUser?.id;
  const instanceId = useId();
  const [externalProfile, setExternalProfile] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const profile = isOwn ? currentUser : externalProfile;

  useEffect(() => {
    if (isOwn || !targetId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, isOwn]);

  useEffect(() => {
    if (!targetId) return;
    const sub = supabase
      .channel(`users:${targetId}:${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${targetId}`,
        },
        (payload) => {
          const next = payload.new as DbUser;
          if (isOwn) setProfile(next);
          else setExternalProfile(next);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [targetId, instanceId, isOwn, setProfile]);

  async function load() {
    if (!targetId) return;
    setLoading(true);
    setNotFound(false);
    try {
      const { data } = await supabase.from('users').select('*').eq('id', targetId).maybeSingle();
      if (!data) {
        if (!isOwn) setExternalProfile(null);
        setNotFound(true);
        return;
      }
      if (isOwn) setProfile(data);
      else setExternalProfile(data);
    } finally {
      setLoading(false);
    }
  }

  async function updateProfile(
    fields: Partial<
      Pick<DbUser, 'display_name' | 'avatar_url' | 'date_of_birth' | 'phone' | 'username'>
    >
  ) {
    if (!currentUser) throw new Error('Not signed in');
    const { data, error } = await supabase
      .from('users')
      .update(fields)
      .eq('id', currentUser.id)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new Error('Update returned no row');
    setProfile(data);
  }

  return { profile, loading, notFound, updateProfile, refresh: load };
}
