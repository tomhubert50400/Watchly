// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

for (const file of ['ReleaseAlertRow.tsx', 'WatchlistRail.tsx']) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const tokens = source.match(/<Pressable\b|<\/Pressable>/g) ?? [];
  let depth = 0;
  let maximumDepth = 0;
  for (const token of tokens) {
    depth += token === '</Pressable>' ? -1 : 1;
    maximumDepth = Math.max(maximumDepth, depth);
  }
  assert.equal(depth, 0, `${file} Pressable tags must be balanced`);
  assert.ok(maximumDepth <= 1, `${file} must expose sibling actions instead of nested Pressables`);
}

const librarySource = readFileSync(new URL('LibraryScreen.tsx', import.meta.url), 'utf8');
assert.match(
  librarySource,
  /accessibilityLabel: 'In progress', label: 'Progress'/,
  'the constrained Library segment must keep the full accessible name while using a non-truncating visible label',
);

console.log('Library action structure QA passed.');
