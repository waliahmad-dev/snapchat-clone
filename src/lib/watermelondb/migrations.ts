import {
  schemaMigrations,
  addColumns,
  createTable,
} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'messages',
          columns: [
            { name: 'reply_to_message_id', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'friends',
          columns: [{ name: 'is_requester', type: 'boolean' }],
        }),
        createTable({
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
    },
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: 'memories',
          columns: [
            { name: 'gallery_asset_id', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 5,
      steps: [
        createTable({
          name: 'group_chats',
          columns: [
            { name: 'remote_id', type: 'string', isIndexed: true },
            { name: 'name', type: 'string', isOptional: true },
            { name: 'avatar_url', type: 'string', isOptional: true },
            { name: 'created_by', type: 'string' },
            { name: 'last_message_text', type: 'string', isOptional: true },
            { name: 'last_message_at', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'synced_at', type: 'number', isOptional: true },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ],
        }),
        createTable({
          name: 'group_members',
          columns: [
            { name: 'remote_id', type: 'string', isIndexed: true },
            { name: 'group_id', type: 'string', isIndexed: true },
            { name: 'user_id', type: 'string', isIndexed: true },
            { name: 'notifications', type: 'string' },
            { name: 'joined_at', type: 'number' },
            { name: 'left_at', type: 'number', isOptional: true },
          ],
        }),
        createTable({
          name: 'group_messages',
          columns: [
            { name: 'remote_id', type: 'string', isIndexed: true },
            { name: 'group_id', type: 'string', isIndexed: true },
            { name: 'sender_id', type: 'string', isIndexed: true },
            { name: 'content', type: 'string', isOptional: true },
            { name: 'media_url', type: 'string', isOptional: true },
            { name: 'type', type: 'string' },
            { name: 'mentions_json', type: 'string' },
            { name: 'saved_by_json', type: 'string' },
            { name: 'reply_to_message_id', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
            { name: 'is_optimistic', type: 'boolean' },
          ],
        }),
        createTable({
          name: 'group_message_views',
          columns: [
            { name: 'message_id', type: 'string', isIndexed: true },
            { name: 'user_id', type: 'string', isIndexed: true },
            { name: 'viewed_at', type: 'number' },
            { name: 'screenshot_at', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
