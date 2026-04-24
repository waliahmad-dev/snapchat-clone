import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class Conversation extends Model {
  static table = 'conversations';

  @text('remote_id') remoteId!: string;
  @text('participant_1_id') participant1Id!: string;
  @text('participant_2_id') participant2Id!: string;
  @text('last_message_text') lastMessageText!: string | null;
  @field('last_message_at') lastMessageAt!: number | null;
  @field('streak_count') streakCount!: number;
  @field('unread_count') unreadCount!: number;
  @field('updated_at') updatedAt!: number;
  @field('synced_at') syncedAt!: number | null;
}
