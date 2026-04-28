import { useState, useEffect } from 'react';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';
import { useDebounce } from '@hooks/useDebounce';
import type { DbUser } from '@/types/database';
import { SEARCH_DEBOUNCE_MS } from '@constants/config';

export function useSearch() {
  const profile = useAuthStore((s) => s.profile);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    search(debouncedQuery.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, profile?.id]);

  async function search(q: string) {
    setLoading(true);
    try {
      const [{ data: rows }, { data: myBlocks }] = await Promise.all([
        supabase.from('users').select('*').ilike('username', `%${q}%`).limit(40),
        profile
          ? supabase.from('blocks').select('blocked_id').eq('blocker_id', profile.id)
          : Promise.resolve({ data: [] as { blocked_id: string }[] }),
      ]);

      const blockedIds = new Set((myBlocks ?? []).map((b: { blocked_id: string }) => b.blocked_id));

      const filtered = (rows ?? [])
        .filter((u: DbUser) => u.id !== profile?.id)
        .filter((u: DbUser) => !blockedIds.has(u.id))
        .slice(0, 20);

      setResults(filtered);
    } finally {
      setLoading(false);
    }
  }

  return { query, setQuery, results, loading };
}
