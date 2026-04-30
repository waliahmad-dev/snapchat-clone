import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class GroupChat extends Model {
  static table = 'group_chats';

  @text('remote_id') remoteId!: string;
  @text('name') name!: string | null;
  @text('avatar_url') avatarUrl!: string | null;
  @text('created_by') createdBy!: string;
  @text('last_message_text') lastMessageText!: string | null;
  @field('last_message_at') lastMessageAt!: number | null;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('synced_at') syncedAt!: number | null;
  @field('deleted_at') deletedAt!: number | null;
}
