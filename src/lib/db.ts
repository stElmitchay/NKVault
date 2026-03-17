import { init } from '@instantdb/core';
import schema from '$lib/schema';
import { browser } from '$app/environment';

const APP_ID = '60e86fb7-dd9b-49bb-949e-aa33675eb019';

// Only initialize in the browser — InstantDB needs IndexedDB/browser APIs
export const db = browser
  ? init({ appId: APP_ID, schema })
  : (null as unknown as ReturnType<typeof init>);
