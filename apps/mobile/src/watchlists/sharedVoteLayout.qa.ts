// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('./SharedVoteScreen.tsx', import.meta.url), 'utf8');

assert.match(screen, /<WatchlistPage/, 'the vote detail must use the shared watchlist page shell');
assert.match(screen, /title="Candidates"/, 'candidate choices must be the primary page section');
assert.match(screen, /style=\{styles\.candidateRow\}/, 'candidates must use compact divided rows');
assert.match(screen, /label="Close voting early"/, 'the owner close action must remain available');
assert.doesNotMatch(
  screen,
  /sharedHeader|avatarStack|candidateCard|lifecycleBar|voteTitle|watchlistTitle/,
  'the vote detail must not restore duplicated context or card-heavy layout',
);

console.log('Shared vote layout QA passed.');
