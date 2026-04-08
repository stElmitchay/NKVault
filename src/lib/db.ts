import { init } from '@instantdb/core';
import schema from '$lib/schema';
import { browser } from '$app/environment';

const APP_ID = '60e86fb7-dd9b-49bb-949e-aa33675eb019';

// Pin the inferred type to the schema-bound `init` overload so that
// `db.subscribeQuery` and `db.tx` resolve to a single concrete signature
// instead of an unresolved union (the un-narrowed
// `ReturnType<typeof init>` produces a union of every `init` overload,
// which TypeScript reports as "not callable" at use sites).
type DB = ReturnType<typeof init<typeof schema>>;

// Only initialize in the browser — InstantDB needs IndexedDB/browser APIs
export const db: DB = browser
  ? init({ appId: APP_ID, schema })
  : (null as unknown as DB);
