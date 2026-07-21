// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const personalScreen = source('./PersonalWatchlistScreen.tsx');
const sharedScreen = source('./SharedWatchlistScreen.tsx');
const sharedLayout = source('./WatchlistDetailLayout.tsx');

for (const screen of [personalScreen, sharedScreen]) {
  assert.match(screen, /<WatchlistPage/, 'every watchlist detail must use the shared page shell');
  assert.match(screen, /<WatchlistPosterGrid/, 'every watchlist detail must use the shared poster grid');
  assert.doesNotMatch(screen, /<WatchlistSummary/, 'watchlist details must not repeat header information');
}

assert.match(sharedLayout, /resolveColumnCount/, 'the poster grid must adapt across screen sizes');
assert.match(
  sharedScreen,
  /isVoteComposerOpen \? \(/,
  'shared voting controls must stay hidden until requested',
);
assert.match(
  sharedScreen,
  /headerRight: watchlist \? \(\) => \(/,
  'shared watchlists must expose members from the native header',
);
assert.match(
  sharedScreen,
  /<BottomActionSheet[\s\S]*title="Members"/,
  'member management must live in a focused sheet',
);
assert.match(
  sharedScreen,
  /watchlist\.isOwner \? \([\s\S]*label="Add member"/,
  'only owners must see member invitation controls',
);
assert.doesNotMatch(
  sharedScreen,
  /<SectionHeader[\s\S]{0,180}title="Members"/,
  'members must not remain as a full page section',
);
assert.doesNotMatch(
  sharedScreen,
  /heroCard|posterGrid|sessionCard|ownerCard/,
  'shared lists must not restore their previous card-heavy layout',
);

console.log('Watchlist detail layout QA passed.');
