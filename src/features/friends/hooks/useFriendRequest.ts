import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';
import { purgeRelationshipData } from '../utils/purgeRelationship';

export function useFriendRequest() {
  const profile = useAuthStore((s) => s.profile);

  async function sendRequest(addresseeId: string): Promise<void> {
    if (!profile) return;

    // Clear any stale rows in either direction before inserting. The
    // friendships table has a per-direction UNIQUE constraint, so a
    // leftover `declined` (or legacy `blocked`) row from earlier test
    // sessions would permanently jam any future re-add. We only sweep
    // non-active statuses; a live `pending` or `accepted` row is real
    // state and the caller shouldn't be silently overwriting it.
    await supabase
      .from('friendships')
      .delete()
      .or(
        `and(requester_id.eq.${profile.id},addressee_id.eq.${addresseeId}),` +
          `and(requester_id.eq.${addresseeId},addressee_id.eq.${profile.id})`,
      )
      .not('status', 'in', '(accepted,pending)');

    const { error } = await supabase.from('friendships').insert({
      requester_id: profile.id,
      addressee_id: addresseeId,
      status: 'pending',
    });
    if (error) throw error;
  }

  async function acceptRequest(friendshipId: string): Promise<void> {
    const { data, error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)
      .select()
      .single();
    if (error) throw error;

    if (data && profile) {
      const p1 = [profile.id, data.requester_id].sort()[0];
      const p2 = [profile.id, data.requester_id].sort()[1];
      await supabase.from('conversations').upsert(
        { participant_1: p1, participant_2: p2 },
        { onConflict: 'participant_1,participant_2', ignoreDuplicates: true }
      );
    }
  }

  async function declineRequest(friendshipId: string): Promise<void> {
    // Decline = cancel: hard-delete the row so either side can send a
    // fresh request later. Marking the row `declined` instead would leave
    // a tombstone that the per-direction UNIQUE constraint would treat as
    // a permanent block on re-adding from the same direction.
    await supabase.from('friendships').delete().eq('id', friendshipId);
  }

  async function removeFriend(friendshipId: string): Promise<void> {
    await supabase.from('friendships').delete().eq('id', friendshipId);
  }

  /**
   * Unfriend the other user and clear every shared artefact: messages, snaps,
   * my uploads in storage, and the Redis streak. Re-friending later starts
   * from a blank thread.
   */
  async function unfriendAndPurge(
    friendshipId: string,
    otherUserId: string,
  ): Promise<void> {
    if (!profile) return;
    await supabase.from('friendships').delete().eq('id', friendshipId);
    await purgeRelationshipData(profile.id, otherUserId);
  }

  /**
   * Block is a hard reset: tear down every friendship row between the pair
   * (in either direction), record the block, and purge all shared history
   * (messages, snaps, my media, streak, conversation metadata). After this
   * the users_select RLS hides each side from the other, so the blocked
   * partner instantly drops out of the blocker's search, conversations,
   * friends list, and stories — and vice-versa. Re-friending after an
   * unblock starts from a blank slate.
   *
   * We delete by user pair rather than a single friendship id so a stray
   * second-direction row (rare, but the unique constraint is per-direction)
   * can't survive the block.
   */
  async function blockUser(
    _friendshipId: string | null,
    blockedId: string,
  ): Promise<void> {
    if (!profile) return;
    await supabase
      .from('friendships')
      .delete()
      .or(
        `and(requester_id.eq.${profile.id},addressee_id.eq.${blockedId}),` +
          `and(requester_id.eq.${blockedId},addressee_id.eq.${profile.id})`,
      );
    await supabase
      .from('blocks')
      .upsert(
        { blocker_id: profile.id, blocked_id: blockedId },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
      );
    await purgeRelationshipData(profile.id, blockedId);
  }

  async function getFriendshipStatus(
    otherUserId: string,
  ): Promise<{
    status: string | null;
    friendshipId: string | null;
    /** true when *I* am the requester (I sent the friend request to them). */
    iSentRequest: boolean;
  }> {
    if (!profile) return { status: null, friendshipId: null, iSentRequest: false };

    // Two explicit direction queries beat a single .or(and(...),and(...))
    // filter: the nested form has been brittle under PostgREST URL encoding
    // and .single() throws on zero rows, which made accepted friendships
    // silently read back as "no row" — landing every user on "Add Friend"
    // even inside an active chat. .maybeSingle() returns null cleanly on
    // zero rows instead.
    const { data: outgoing } = await supabase
      .from('friendships')
      .select('id, status')
      .eq('requester_id', profile.id)
      .eq('addressee_id', otherUserId)
      .maybeSingle();
    if (outgoing) {
      return { status: outgoing.status, friendshipId: outgoing.id, iSentRequest: true };
    }

    const { data: incoming } = await supabase
      .from('friendships')
      .select('id, status')
      .eq('requester_id', otherUserId)
      .eq('addressee_id', profile.id)
      .maybeSingle();
    if (incoming) {
      return { status: incoming.status, friendshipId: incoming.id, iSentRequest: false };
    }

    return { status: null, friendshipId: null, iSentRequest: false };
  }

  return {
    sendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
    unfriendAndPurge,
    blockUser,
    getFriendshipStatus,
  };
}
