import { useEffect, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '@lib/watermelondb/database';
import Message from '@lib/watermelondb/models/Message';
import { useAuthStore } from '@features/auth/store/authStore';

export function useUnreadCount(): number {
  const profile = useAuthStore((s) => s.profile);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!profile) return;
    const sub = database
      .get<Message>('messages')
      .query(
        Q.where('viewed_at', null),
        Q.where('deleted_at', null),
        Q.where('sender_id', Q.notEq(profile.id)),
        Q.where('type', Q.notEq('system')),
      )
      .observe()
      .subscribe((rows) => setCount(rows.length));

    return () => sub.unsubscribe();
  }, [profile?.id]);

  return count;
}
