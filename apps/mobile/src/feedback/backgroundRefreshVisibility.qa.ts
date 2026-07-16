// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const screens = [
  '../catalogue/EpisodeDetailScreen.tsx',
  '../catalogue/ExploreScreen.tsx',
  '../catalogue/FilmDetailScreen.tsx',
  '../catalogue/SeasonDetailScreen.tsx',
  '../catalogue/SeriesDetailScreen.tsx',
  '../episodes/SeasonEpisodeList.tsx',
  '../home/HomeScreen.tsx',
  '../journal/JournalScreen.tsx',
  '../library/LibraryScreen.tsx',
  '../notifications/NotificationsScreen.tsx',
  '../profile/ProfileScreen.tsx',
  '../watchlists/PersonalWatchlistScreen.tsx',
  '../watchlists/SharedVoteScreen.tsx',
  '../watchlists/SharedWatchlistScreen.tsx',
].map(source);

const visibleBackgroundMessages = [
  'Keeping current content visible while new data arrives.',
  'Personalizing Home',
  'Cached discovery stays visible while Watchly updates it.',
  'Keeping these results visible while search updates.',
  'Your saved profile stays visible.',
  'Keeping saved alerts visible while checking for updates.',
  'Refreshing film details',
  'Refreshing series details',
  'Refreshing episode details',
  'Refreshing season details',
  'Refreshing episodes and progress',
  'Keeping this list visible while fresh data arrives.',
  'Keeping saved titles visible.',
  'Keeping the saved vote visible.',
];

for (const message of visibleBackgroundMessages) {
  for (const screen of screens) {
    assert.doesNotMatch(
      screen,
      new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `background refresh copy must stay hidden: ${message}`,
    );
  }
}

const homeSource = source('../home/HomeScreen.tsx');
assert.match(
  homeSource,
  /section\.error && section\.items\.length === 0/,
  'Home must hide refresh failures when section content is already visible',
);

const exploreSource = source('../catalogue/ExploreScreen.tsx');
assert.match(
  exploreSource,
  /isLoading && items\.length === 0/,
  'Explore must reserve search loading UI for an empty result area',
);

const progressSource = source('../tracking/EpisodeProgressControl.tsx');
assert.doesNotMatch(
  progressSource,
  /model\.isSaving \|\| model\.isRefreshing/,
  'episode progress must not overlay visible controls during background refresh',
);
assert.match(
  progressSource,
  /\{model\.isSaving \? \(/,
  'episode progress must keep feedback for an explicit save',
);

const feedSource = source('../feed/FeedScreen.tsx');
assert.match(
  feedSource,
  /const hasVisibleItems = itemsRef\.current\.length > 0/,
  'Feed must detect already visible content before showing loading UI',
);
assert.match(
  feedSource,
  /isLoading && items\.length === 0/,
  'Feed must only replace an empty feed with its loading state',
);

console.log('Background refresh visibility QA passed.');
