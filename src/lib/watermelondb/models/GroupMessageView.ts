import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class GroupMessageView extends Model {
  static table = 'group_message_views';

  @text('message_id') messageId!: string;
  @text('user_id') userId!: string;
  @field('viewed_at') viewedAt!: number;
  @field('screenshot_at') screenshotAt!: number | null;
}
