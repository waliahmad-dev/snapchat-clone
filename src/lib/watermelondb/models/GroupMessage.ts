import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { GroupMessageType } from '@/types/database';

export default class GroupMessage extends Model {
  static table = 'group_messages';

  @text('remote_id') remoteId!: string;
  @text('group_id') groupId!: string;
  @text('sender_id') senderId!: string;
  @text('content') content!: string | null;
  @text('media_url') mediaUrl!: string | null;
  @text('type') type!: GroupMessageType;
  @text('mentions_json') mentionsJson!: string;
  @text('saved_by_json') savedByJson!: string;
  @text('reply_to_message_id') replyToMessageId!: string | null;
  @field('created_at') createdAt!: number;
  @field('deleted_at') deletedAt!: number | null;
  @field('is_optimistic') isOptimistic!: boolean;

  get mentions(): string[] {
    try {
      return JSON.parse(this.mentionsJson || '[]') as string[];
    } catch {
      return [];
    }
  }

  get savedBy(): string[] {
    try {
      return JSON.parse(this.savedByJson || '[]') as string[];
    } catch {
      return [];
    }
  }
}
