import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { FriendshipStatus } from '@/types/database';

export default class Friend extends Model {
  static table = 'friends';

  @text('remote_id') remoteId!: string;
  @text('user_id') userId!: string;
  @text('username') username!: string;
  @text('display_name') displayName!: string;
  @text('avatar_url') avatarUrl!: string | null;
  @text('status') status!: FriendshipStatus;
  @field('snap_score') snapScore!: number;
  @field('created_at') createdAt!: number;
  @field('synced_at') syncedAt!: number | null;
}
