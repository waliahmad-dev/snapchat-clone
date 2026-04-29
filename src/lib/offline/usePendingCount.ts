import { useEffect, useState } from 'react';
import { database } from '@lib/watermelondb/database';
import Outbox from '@lib/watermelondb/models/Outbox';

export function usePendingCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sub = database
      .get<Outbox>('outbox')
      .query()
      .observe()
      .subscribe((rows) => setCount(rows.length));
    return () => sub.unsubscribe();
  }, []);

  return count;
}
