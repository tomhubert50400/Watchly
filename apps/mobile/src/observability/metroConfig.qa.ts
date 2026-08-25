// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { resolve } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const metroConfig = require('../../metro.config.js') as {
  watchFolders: string[];
};
const apiRoot = resolve(__dirname, '../../../api');
const webRoot = resolve(__dirname, '../../../web');
const watchedRoots = new Set(metroConfig.watchFolders.map((folder) => resolve(folder)));

assert(
  !watchedRoots.has(apiRoot),
  'Metro must not watch the API workspace that Prisma rewrites during mobile development',
);
assert(!watchedRoots.has(webRoot), 'Metro must not watch the unrelated web workspace');

console.log('Metro config QA passed.');
