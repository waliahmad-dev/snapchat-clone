import { supabase } from '@lib/supabase/client';
import { resetStreak } from '@lib/redis/streak';

/**
 * Wipe every trace of a 1-on-1 relationship so a later re-friend truly starts
 * from scratch (no ghost messages, no lingering media, no pre-existing streak).
 *
 * What the SQL schema constrains
 * ------------------------------
 *  - messages / snaps / conversations have NO `FOR DELETE` RLS policy, so we
 *    cannot hard-delete them from the client. Instead we use their
 *    `deleted_at` columns (messages/snaps) and hide zero-message rows in the
 *    chat list. Conversations have no `deleted_at` column, so we null out
 *    `last_message_id` + reset the streak counter so the stale row looks
 *    pristine when the pair re-friends and the UI starts using it again.
 *  - Storage RLS is path-based ({user_id}/...): we can only delete our own
 *    uploads. The other side's media becomes orphan; acceptable and
 *    documented. A server-side sweep can reclaim those later.
 *
 * This is best-effort: individual step failures are logged (swallowed) so the
 * user-facing unfriend/block still succeeds even if one side-effect fails.
 */
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
