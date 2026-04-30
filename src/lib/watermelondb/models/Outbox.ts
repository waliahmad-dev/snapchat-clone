import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export type OutboxStatus = 'pending' | 'in_flight' | 'failed';

export default class Outbox extends Model {
  static table = 'outbox';

  @text('kind') kind!: string;
  @text('payload') payload!: string;
  @text('status') status!: OutboxStatus;
  @field('attempts') attempts!: number;
  @text('last_error') lastError!: string | null;
  @field('created_at') createdAt!: number;
  @field('next_attempt_at') nextAttemptAt!: number;
  @text('group_key') groupKey!: string | null;
}
