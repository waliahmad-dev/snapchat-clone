import { Database } from '@nozbe/watermelondb';
import { NativeModules } from 'react-native';
import { schema } from './schema';
import { migrations } from './migrations';
import Conversation from './models/Conversation';
import Message from './models/Message';
import Friend from './models/Friend';
import Memory from './models/Memory';

const nativeAvailable = !!NativeModules.WMDatabaseBridge;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adapter: any;

if (nativeAvailable) {
  const SQLiteAdapter = require('@nozbe/watermelondb/adapters/sqlite').default;
  adapter = new SQLiteAdapter({
    schema,
    migrations,
    jsi: false,
    onSetUpError: (error: unknown) => console.error('[WatermelonDB] SQLite error:', error),
  });
} else {
  const LokiJSAdapter = require('@nozbe/watermelondb/adapters/lokijs').default;
  adapter = new LokiJSAdapter({
    schema,
    migrations,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
    onSetUpError: (error: unknown) => console.error('[WatermelonDB] LokiJS error:', error),
  });
}

export const database = new Database({
  adapter,
  modelClasses: [Conversation, Message, Friend, Memory],
});
