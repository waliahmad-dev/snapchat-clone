import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';
import { purgeRelationshipData } from '../utils/purgeRelationship';

export function useFriendRequest() {
  const profile = useAuthStore((s) => s.profile);

  async function sendRequest(addresseeId: string): Promise<void> {
    if (!profile) return;
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
    await supabase
      .from('friendships')
      .update({ status: 'declined' })
      .eq('id', friendshipId);
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
   * Block is unfriend-plus: same cascade cleanup, but we also record the
   * block in `public.blocks` so the blocked user disappears from search
   * results on this device.
   */
  async function blockUser(
    friendshipId: string | null,
    blockedId: string,
  ): Promise<void> {
    if (!profile) return;
    if (friendshipId) {
      await supabase.from('friendships').delete().eq('id', friendshipId);
    }
    await supabase
      .from('blocks')
      .upsert(
        { blocker_id: profile.id, blocked_id: blockedId },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
      );
    await purgeRelationshipData(profile.id, blockedId);
  }

  async function getFriendshipStatus(
    otherUserId: string
  ): Promise<{ status: string | null; friendshipId: string | null }> {
    if (!profile) return { status: null, friendshipId: null };

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
    if (outgoing) return { status: outgoing.status, friendshipId: outgoing.id };

    const { data: incoming } = await supabase
      .from('friendships')
      .select('id, status')
      .eq('requester_id', otherUserId)
      .eq('addressee_id', profile.id)
      .maybeSingle();
    if (incoming) return { status: incoming.status, friendshipId: incoming.id };

    return { status: null, friendshipId: null };
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
