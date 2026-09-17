import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizePersonalWatchlist } from '../api/watchlists';
import {
  groupPersonalWatchlistItems,
  resolveCarriedPosterTilt,
  resolveDestinationSectionId,
  resolveWatchlistAutoScrollDelta,
  SECTION_PREVIEW_ITEM_COUNT,
  UNSECTIONED_SECTION_ID,
} from './watchlistSections';

const sections = [
  { id: 'horror', name: 'Horror', position: 0, createdAt: '', updatedAt: '' },
  { id: 'rewatch', name: 'Rewatch', position: 1, createdAt: '', updatedAt: '' },
];
const items = [
  { id: 'a', sectionId: 'rewatch', contentType: 'movie' as const, createdAt: '', tmdbId: 1, posterUrl: null, title: 'A' },
  { id: 'b', sectionId: null, contentType: 'series' as const, createdAt: '', tmdbId: 2, posterUrl: null, title: 'B' },
  { id: 'c', sectionId: 'deleted', contentType: 'movie' as const, createdAt: '', tmdbId: 3, posterUrl: null, title: 'C' },
];

const groups = groupPersonalWatchlistItems(sections, items);
assert.deepEqual(groups.map((group) => group.id), ['horror', 'rewatch', UNSECTIONED_SECTION_ID]);
assert.deepEqual(groups[1].items.map((item) => item.id), ['a']);
assert.deepEqual(groups[2].items.map((item) => item.id), ['b', 'c']);
assert.equal(resolveDestinationSectionId(UNSECTIONED_SECTION_ID), null);
assert.equal(resolveDestinationSectionId('horror'), 'horror');
assert.equal(SECTION_PREVIEW_ITEM_COUNT, 6);
assert(resolveCarriedPosterTilt(10) < 0, 'the bottom of a poster carried to the right must lag to the left');
assert(resolveCarriedPosterTilt(-10) > 0, 'the bottom of a poster carried to the left must lag to the right');
assert.equal(resolveCarriedPosterTilt(100), -16, 'carried poster rotation must stay controlled');
assert(resolveWatchlistAutoScrollDelta(20, 0, 800) < 0, 'dragging near the top must scroll upward');
assert.equal(resolveWatchlistAutoScrollDelta(400, 0, 800), 0, 'dragging in the middle must not scroll');
assert(resolveWatchlistAutoScrollDelta(780, 0, 800) > 0, 'dragging near the bottom must scroll downward');

const legacyWatchlist = normalizePersonalWatchlist({
  createdAt: '',
  id: 'legacy',
  items: [{ contentType: 'movie', createdAt: '', id: 'legacy-item', tmdbId: 1 }],
  name: 'Legacy',
  updatedAt: '',
  visibility: 'private',
});
assert.deepEqual(legacyWatchlist.sections, []);
assert.equal(legacyWatchlist.items[0]?.sectionId, null);

const screen = readFileSync(new URL('./PersonalWatchlistScreen.tsx', import.meta.url), 'utf8');
const grid = readFileSync(new URL('./WatchlistDetailLayout.tsx', import.meta.url), 'utf8');
assert.match(grid, /onPress=\{\(\) => \{[\s\S]*onOpen\(item\)/, 'a normal press must keep opening the title');
assert.match(grid, /onLongPress=\{\(event\) => \{[\s\S]*onMoveStart\(item, event, \{[\s\S]*width: itemWidth/, 'a long press must preserve the poster size and grip point');
assert.match(grid, /onTouchEnd=\{\(event\) => \{[\s\S]*onMoveEnd\?\.\(item, event\)/, 'moving must finish when the finger lifts');
assert.doesNotMatch(grid, /onPressOut=\{[\s\S]*onMoveEnd/, 'leaving the original poster must not stop an active move');
assert.match(screen, /WatchlistMoveOverlay/, 'moving must keep a poster preview under the finger');
assert.match(screen, /targetViewsRef\.current\.set\(group\.id, view\)/, 'the visible sections must be the drop targets');
assert.match(screen, /resolveWatchlistAutoScrollDelta/, 'dragging near an edge must keep scrolling the watchlist');
assert.match(screen, /Animated\.spring\(dragTilt/, 'horizontal movement must tilt the carried poster with spring physics');
assert.match(screen, /transform: \[\{ rotate: rotation \}, \{ scale: dragScale \}\]/, 'the carried poster must animate its tilt and lift');
assert.match(screen, /transformOrigin: \[moving\.gripX, moving\.gripY, 0\]/, 'the poster must swing around the point held by the user');
assert.doesNotMatch(screen, /style=\{styles\.movePanel\}/, 'moving must not replace the watchlist with a destination panel');
assert.match(screen, /SECTION_PREVIEW_ITEM_COUNT/, 'large sections must start with a bounded grid');

console.log('Watchlist section QA passed: grouping, fallback, bounded grids, title press and direct long-press section moves.');
