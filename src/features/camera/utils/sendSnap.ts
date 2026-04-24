import { supabase } from '@lib/supabase/client';
import { uploadToStorage } from '@lib/supabase/storage';
import { processImage } from '@lib/imageManipulator/processor';
import { recordSnapSent } from '@lib/redis/streak';
import { ensureConversation } from '@features/chat/utils/conversation';

export interface SendSnapOptions {
  senderId: string;
  senderName: string;
  imageUri: string;
  recipientIds: string[];
  postToMyStory?: boolean;
}


export async function sendSnapToRecipients({
  senderId,
  senderName,
  imageUri,
  recipientIds,
  postToMyStory = false,
}: SendSnapOptions): Promise<void> {
  if (recipientIds.length === 0 && !postToMyStory) return;

  const processed = await processImage(imageUri);
  const snapId = `${senderId}/${Date.now()}`;
  const fullPath = `${snapId}_full.jpg`;
  const thumbPath = `${snapId}_thumb.jpg`;

  await Promise.all([
    uploadToStorage('snaps', fullPath, processed.full.uri),
    uploadToStorage('snaps', thumbPath, processed.thumbnail.uri),
  ]);

  if (recipientIds.length > 0) {
    const { error: snapsErr } = await supabase.from('snaps').insert(
      recipientIds.map((recipient_id) => ({
        sender_id: senderId,
        recipient_id,
        media_url: fullPath,
      })),
    );
    if (snapsErr) throw snapsErr;

    await Promise.all(
      recipientIds.map((rid) =>
        recordSnapSent(senderId, rid).catch(() => null),
      ),
    );

    await Promise.all(
      recipientIds.map(async (recipient_id) => {
        const convId = await ensureConversation(senderId, recipient_id);
        if (!convId) return;

        const { count: priorSnapCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', convId)
          .eq('type', 'snap');
        const isFirstSnap = !priorSnapCount;

        if (isFirstSnap) {
          await supabase.from('messages').insert({
            conversation_id: convId,
            sender_id: senderId,
            content: '🔥 Streak started!',
            type: 'system',
          });
        }

        await supabase.from('messages').insert({
          conversation_id: convId,
          sender_id: senderId,
          media_url: fullPath,
          type: 'snap',
        });

        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', convId);
      }),
    );
  }

  if (postToMyStory) {
    const storyPath = `${senderId}/${Date.now()}_story.jpg`;
    await uploadToStorage('stories', storyPath, processed.full.uri);
    await supabase.from('stories').insert({
      user_id: senderId,
      media_url: storyPath,
    });
  }

  void senderName; 
}
