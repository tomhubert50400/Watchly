import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizePersonalWatchlist } from '../api/watchlists';
import {
  groupPersonalWatchlistItems,
  resolveDestinationSectionId,
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
assert.match(grid, /onLongPress=\{\(event\) => \{[\s\S]*onMoveStart\(item, event\)/, 'a long press must start moving');
assert.match(screen, /WatchlistMoveOverlay/, 'moving must use compact section targets');
assert.match(screen, /SECTION_PREVIEW_ITEM_COUNT/, 'large sections must start with a bounded grid');

console.log('Watchlist section QA passed: grouping, fallback, bounded grids, title press and compact long-press move mode.');
