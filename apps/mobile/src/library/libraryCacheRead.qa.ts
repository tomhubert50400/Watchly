// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('useLibraryData.ts', import.meta.url), 'utf8');
assert.doesNotMatch(
  source,
  /readPersistedCache/,
  'useCachedResource must be the only persisted Library cache reader',
);
assert.match(
  source,
  /useCallback\(async \(cached\?: LibraryData\)/,
  'Library loading must consume the cached value already supplied by useCachedResource',
);
assert.match(
  source,
  /fallback && !isCataloguePlaceholderTitle\(fallback\.title\)/,
  'resolved catalogue metadata must survive a Library revalidation without another detail request',
);

console.log('Library cache read QA passed.');
