import { supabase } from '@lib/supabase/client';
import { resetStreak } from '@lib/redis/streak';

export async function purgeRelationshipData(meId: string, otherId: string): Promise<void> {
  const nowIso = new Date().toISOString();

  const { data: convs } = await supabase
    .from('conversations')
    .select('id')
    .or(
      `and(participant_1.eq.${meId},participant_2.eq.${otherId}),` +
        `and(participant_1.eq.${otherId},participant_2.eq.${meId})`
    );
  const convIds = (convs ?? []).map((c: { id: string }) => c.id);

  if (convIds.length > 0) {
    const { data: myMsgs } = await supabase
      .from('messages')
      .select('media_url')
      .in('conversation_id', convIds)
      .eq('sender_id', meId)
      .not('media_url', 'is', null);

    const myMediaPaths = (myMsgs ?? [])
      .map((m: { media_url: string | null }) => m.media_url)
      .filter((p): p is string => !!p);

    if (myMediaPaths.length > 0) {
      const thumbPaths = myMediaPaths.map((p) => p.replace(/_full\.(jpe?g|png)$/i, '_thumb.$1'));
      await supabase.storage
        .from('snaps')
        .remove(myMediaPaths)
        .catch(() => null);
      await supabase.storage
        .from('snaps')
        .remove(thumbPaths)
        .catch(() => null);
    }

    await supabase
      .from('messages')
      .update({ deleted_at: nowIso })
      .in('conversation_id', convIds)
      .is('deleted_at', null);

    await supabase
      .from('conversations')
      .update({ last_message_id: null, streak_count: 0 })
      .in('id', convIds);
  }

  await supabase
    .from('snaps')
    .update({ deleted_at: nowIso })
    .or(
      `and(sender_id.eq.${meId},recipient_id.eq.${otherId}),` +
        `and(sender_id.eq.${otherId},recipient_id.eq.${meId})`
    )
    .is('deleted_at', null);

  await resetStreak(meId, otherId).catch(() => null);
}
