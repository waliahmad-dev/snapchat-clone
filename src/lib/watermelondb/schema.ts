import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 3,
  tables: [
    tableSchema({
      name: 'conversations',
      columns: [
        { name: 'remote_id', type: 'string', isIndexed: true },
        { name: 'participant_1_id', type: 'string', isIndexed: true },
        { name: 'participant_2_id', type: 'string', isIndexed: true },
        { name: 'last_message_text', type: 'string', isOptional: true },
        { name: 'last_message_at', type: 'number', isOptional: true },
        { name: 'streak_count', type: 'number' },
        { name: 'unread_count', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'messages',
      columns: [
        { name: 'remote_id', type: 'string', isIndexed: true },
        { name: 'conversation_id', type: 'string', isIndexed: true },
        { name: 'sender_id', type: 'string', isIndexed: true },
        { name: 'content', type: 'string', isOptional: true },
        { name: 'media_url', type: 'string', isOptional: true },
        { name: 'type', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'viewed_at', type: 'number', isOptional: true },
        { name: 'saved', type: 'boolean' },
        { name: 'deleted_at', type: 'number', isOptional: true },
        { name: 'is_optimistic', type: 'boolean' },
        { name: 'reply_to_message_id', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'friends',
      columns: [
        { name: 'remote_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'username', type: 'string' },
        { name: 'display_name', type: 'string' },
        { name: 'avatar_url', type: 'string', isOptional: true },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'is_requester', type: 'boolean' },
        { name: 'snap_score', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'memories',
      columns: [
        { name: 'remote_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'media_url', type: 'string' },
        { name: 'thumbnail_url', type: 'string' },
        { name: 'source', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'upload_status', type: 'string' },
        { name: 'local_path', type: 'string', isOptional: true },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'outbox',
      columns: [
        { name: 'kind', type: 'string', isIndexed: true },
        { name: 'payload', type: 'string' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'attempts', type: 'number' },
        { name: 'last_error', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'next_attempt_at', type: 'number' },
        { name: 'group_key', type: 'string', isIndexed: true, isOptional: true },
      ],
    }),
  ],
});
