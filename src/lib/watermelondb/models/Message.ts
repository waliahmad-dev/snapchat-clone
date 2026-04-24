import { Model } from '@nozbe/watermelondb';
import { field, text, relation } from '@nozbe/watermelondb/decorators';
import Conversation from './Conversation';
import type { MessageType } from '@/types/database';

export default class Message extends Model {
  static table = 'messages';
  static associations = {
    conversations: { type: 'belongs_to' as const, key: 'conversation_id' },
  };

  @text('remote_id') remoteId!: string;
  @text('conversation_id') conversationId!: string;
  @text('sender_id') senderId!: string;
  @text('content') content!: string | null;
  @text('media_url') mediaUrl!: string | null;
  @text('type') type!: MessageType;
  @field('created_at') createdAt!: number;
  @field('viewed_at') viewedAt!: number | null;
  @field('saved') saved!: boolean;
  @field('deleted_at') deletedAt!: number | null;
  @field('is_optimistic') isOptimistic!: boolean;

  @relation('conversations', 'conversation_id') conversation!: Conversation;
}
