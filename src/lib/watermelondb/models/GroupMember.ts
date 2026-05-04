import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { GroupNotificationsSetting } from '@/types/database';

export default class GroupMember extends Model {
  static table = 'group_members';

  @text('remote_id') remoteId!: string;
  @text('group_id') groupId!: string;
  @text('user_id') userId!: string;
  @text('notifications') notifications!: GroupNotificationsSetting;
  @field('joined_at') joinedAt!: number;
  @field('left_at') leftAt!: number | null;
}
