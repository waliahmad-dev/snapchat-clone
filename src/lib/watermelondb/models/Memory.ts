import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { MediaSource, UploadStatus } from '@/types/database';

export default class Memory extends Model {
  static table = 'memories';

  @text('remote_id') remoteId!: string | null;
  @text('media_url') mediaUrl!: string;
  @text('thumbnail_url') thumbnailUrl!: string;
  @text('source') source!: MediaSource;
  @field('created_at') createdAt!: number;
  @text('upload_status') uploadStatus!: UploadStatus;
  @text('local_path') localPath!: string | null;
  @field('deleted_at') deletedAt!: number | null;
}
