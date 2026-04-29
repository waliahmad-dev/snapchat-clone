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
  ],
});
