import { router } from 'expo-router';
import { ensureConversation } from './conversation';
import type { DbUser } from '@/types/database';


export async function openChatWith(
  myId: string,
  friend: Pick<DbUser, 'id' | 'display_name'>,
): Promise<void> {
  const conversationId = await ensureConversation(myId, friend.id);
  if (!conversationId) return;

  router.push({
    pathname: '/(app)/chat/[conversationId]',
    params: {
      conversationId,
      friendId: friend.id,
      friendName: friend.display_name,
    },
  });
}
