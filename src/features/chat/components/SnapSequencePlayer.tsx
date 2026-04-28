import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase/client';
import { SnapViewer } from './SnapViewer';
import type { DbMessage } from '@/types/database';

interface Props {
  messageIds: string[];
  myName: string;
  conversationId: string;
  onFinish: () => void;
}

export function SnapSequencePlayer({ messageIds, myName, conversationId, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const [rows, setRows] = useState<DbMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (messageIds.length === 0) {
      onFinish();
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('messages').select('*').in('id', messageIds);
      if (cancelled) return;
      const byId = new Map((data ?? []).map((m: DbMessage) => [m.id, m]));
      setRows(messageIds.map((id) => byId.get(id)).filter((m): m is DbMessage => !!m));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [messageIds, onFinish]);

  const current = rows[index];

  const advance = useCallback(
    (savedInSession: boolean) => {
      if (!current) return;
      if (!savedInSession) {
        supabase
          .from('messages')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', current.id)
          .then(() => undefined);
      }
      if (index + 1 >= rows.length) {
        onFinish();
      } else {
        setIndex((i) => i + 1);
      }
    },
    [current, index, rows.length, onFinish]
  );

  const onSave = useCallback(() => {
    if (!current) return;
    supabase
      .from('messages')
      .update({ saved: true })
      .eq('id', current.id)
      .then(() => undefined);
    supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: current.sender_id,
        content: `${myName} saved a snap`,
        type: 'system',
      })
      .then(() => undefined);
  }, [current, conversationId, myName]);

  const onUnsave = useCallback(() => {
    if (!current) return;
    supabase
      .from('messages')
      .update({ saved: false, deleted_at: new Date().toISOString() })
      .eq('id', current.id)
      .then(() => undefined);
  }, [current]);

  if (loading || !current || !current.media_url) return null;

  return (
    <SnapViewer
      key={current.id}
      mediaPath={current.media_url}
      isOwn={false}
      alreadySaved={!!current.saved}
      onClose={(savedInSession) => advance(savedInSession)}
      onSave={onSave}
      onUnsave={onUnsave}
    />
  );
}
