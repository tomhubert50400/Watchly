// @ts-expect-error QA runs under Node, outside the Expo runtime types.
import assert from 'node:assert/strict';
import type { LibraryListItem } from '../library/useLibraryData';
import { selectHomeWatchlistItems } from './watchlistHomeModel';

const makeList = (id: string, kind: 'personal' | 'shared', date: string): LibraryListItem => ({
  id, key: `${kind}:${id}`, kind, name: id, isOwner: kind === 'personal', itemCount: 4, memberCount: 2, posterUrls: [], updatedAt: date,
  previewItems: [1, 2, 3, 4].map((tmdbId) => ({ contentType: kind === 'personal' ? 'movie' : 'series', tmdbId, title: `${id}-${tmdbId}`, posterUrl: `poster-${tmdbId}` })),
});
const personal = makeList('Mine', 'personal', '2026-09-13');
const shared = makeList('Friends', 'shared', '2026-09-14');
const items = selectHomeWatchlistItems([personal, shared]);
assert.equal(items.length, 6);
assert.deepEqual(items.slice(0, 4).map((item) => item.listName), ['Friends', 'Mine', 'Friends', 'Mine']);
assert.equal(items[0]?.contentType, 'series');
assert.equal(items[1]?.contentType, 'movie', 'movie and series with the same TMDB ID must remain distinct');
const duplicate = { ...personal, id: 'duplicate', name: 'Older', updatedAt: '2026-09-01' };
assert.equal(selectHomeWatchlistItems([personal, duplicate]).length, 4);
assert.equal(selectHomeWatchlistItems([{ ...personal, previewItems: undefined }]).length, 0);
assert.equal(selectHomeWatchlistItems([{ ...personal, previewItems: [{ ...personal.previewItems![0]!, posterUrl: null }] }]).length, 0);
assert.deepEqual(selectHomeWatchlistItems([]), []);
console.log('Home watchlist selection QA passed.');
