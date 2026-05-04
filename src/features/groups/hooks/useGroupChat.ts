import { useEffect, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '@lib/watermelondb/database';
import GroupChat from '@lib/watermelondb/models/GroupChat';

export interface GroupSummary {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  createdBy: string;
}

export function useGroupChat(groupId: string): {
  group: GroupSummary | null;
  loading: boolean;
} {
  const [group, setGroup] = useState<GroupSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    const sub = database
      .get<GroupChat>('group_chats')
      .query(Q.where('remote_id', groupId))
      .observeWithColumns(['name', 'avatar_url', 'created_by'])
      .subscribe((rows) => {
        if (rows.length === 0) {
          setGroup(null);
        } else {
          const g = rows[0];
          setGroup({
            id: g.remoteId,
            name: g.name,
            avatarUrl: g.avatarUrl,
            createdBy: g.createdBy,
          });
        }
        setLoading(false);
      });
    return () => sub.unsubscribe();
  }, [groupId]);

  return { group, loading };
}
