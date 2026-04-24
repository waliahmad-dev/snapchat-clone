import { supabase } from '@lib/supabase/client';


export async function ensureConversation(
  myId: string,
  otherId: string,
): Promise<string | null> {
  const [p1, p2] = [myId, otherId].sort();

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('participant_1', p1)
    .eq('participant_2', p2)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ participant_1: p1, participant_2: p2 })
    .select('id')
    .single();

  if (created?.id) return created.id;

  if (error) {
    const { data: refetched } = await supabase
      .from('conversations')
      .select('id')
      .eq('participant_1', p1)
      .eq('participant_2', p2)
      .maybeSingle();
    return refetched?.id ?? null;
  }

  return null;
}
