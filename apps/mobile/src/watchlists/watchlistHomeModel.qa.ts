// @ts-expect-error QA runs under Node, outside the Expo runtime types.
import assert from 'node:assert/strict';
import type { LibraryListItem } from '../library/useLibraryData';
import { selectHomeWatchlistItems } from './watchlistHomeModel';
import { loadWatchlistPreviewUrls } from './watchlistPreview';

const makeList = (id: string, kind: 'personal' | 'shared', date: string): LibraryListItem => ({
  id, key: `${kind}:${id}`, kind, name: id, isOwner: kind === 'personal', itemCount: 4, memberCount: 2, posterUrls: [], updatedAt: date,
  previewItems: [1, 2, 3, 4].map((tmdbId) => ({ contentType: kind === 'personal' ? 'movie' : 'series', tmdbId, title: `${id}-${tmdbId}`, posterUrl: `poster-${tmdbId}` })),
});
const personal = makeList('Mine', 'personal', '2026-09-13');
const shared = makeList('Friends', 'shared', '2026-09-14');
const items = selectHomeWatchlistItems([personal, shared]);
assert.equal(items.length, 8);
assert.deepEqual(items.slice(0, 4).map((item) => item.listName), ['Friends', 'Mine', 'Friends', 'Mine']);
assert.equal(items[0]?.contentType, 'series');
assert.equal(items[1]?.contentType, 'movie', 'movie and series with the same TMDB ID must remain distinct');
const duplicate = { ...personal, id: 'duplicate', name: 'Older', updatedAt: '2026-09-01' };
assert.equal(selectHomeWatchlistItems([personal, duplicate]).length, 4);
assert.equal(selectHomeWatchlistItems([{ ...personal, previewItems: undefined }]).length, 0);
assert.equal(selectHomeWatchlistItems([{ ...personal, previewItems: [{ ...personal.previewItems![0]!, posterUrl: null }] }]).length, 0);
assert.deepEqual(selectHomeWatchlistItems([]), []);
const hidden = { ...personal, showOnHome: false };
assert.deepEqual(selectHomeWatchlistItems([hidden]), [], 'An excluded list contributes no titles to Home');
assert.ok(selectHomeWatchlistItems([hidden, shared]).every((item) => item.listId === shared.id), 'Other lists remain visible');
assert.ok(selectHomeWatchlistItems([hidden, duplicate]).every((item) => item.listId === duplicate.id), 'A title in a visible list remains eligible even if also in a hidden list');
assert.equal(selectHomeWatchlistItems([{ ...hidden, showOnHome: true }]).length, 4, 'Re-enabling restores the list to Home');
assert.equal(personal.previewItems?.length, 4, 'Home filtering must not remove any watchlist membership');
const planned = {
  ...personal, isPlanned: true,
  previewItems: Array.from({ length: 20 }, (_, index) => ({
    contentType: 'movie' as const, tmdbId: index + 1, title: `Movie ${index + 1}`, posterUrl: `poster-${index + 1}`,
  })),
};
assert.equal(selectHomeWatchlistItems([planned]).length, 12, 'One large Planned list can fill all 12 Home slots');
assert.equal(selectHomeWatchlistItems([planned, shared]).length, 12, 'Multiple lists remain capped at 12 unique titles');
assert.deepEqual(selectHomeWatchlistItems([{ ...planned, showOnHome: false }]), [], 'Planned respects Home exclusion');

async function verifyPreviews() {
  const originalFetch = globalThis.fetch;
  const sourceItems = planned.previewItems.map((item) => ({ ...item, id: String(item.tmdbId), createdAt: '2026-10-02' }));
  const coverItemIds = ['20', '19'];
  globalThis.fetch = async () => new Response(JSON.stringify({ items: sourceItems, coverItemIds }));
  try {
    for (const kind of ['personal', 'shared'] as const) {
      const hydrated: number[] = [];
      let active = 0;
      let maxActive = 0;
      const cover = await loadWatchlistPreviewUrls({
        fallback: [], list: { id: 'list', kind }, token: 'qa', includeHomeItems: true,
        loadArtwork: async (item, index) => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await Promise.resolve();
          hydrated[index] = item.tmdbId;
          active -= 1;
          return `artwork-${item.tmdbId}`;
        },
      });
      assert.deepEqual(cover, ['artwork-20', 'artwork-19'], 'Hydrating Home titles preserves the selected cover');
      assert.equal(hydrated.length, 12, 'The real preview loader hydrates 12 titles for Home');
      assert.equal(new Set(hydrated).size, 12, 'Cover titles are not hydrated twice');
      assert.ok(maxActive <= 4, 'Expanding previews keeps catalogue requests bounded');
    }
    let loaded = 0;
    await loadWatchlistPreviewUrls({ fallback: [], list: { id: 'list', kind: 'personal' }, token: 'qa', loadArtwork: async () => { loaded += 1; return 'cover'; } });
    assert.equal(loaded, 2, 'Cover-only consumers do not hydrate extra Home titles');
    console.log('Home watchlist selection and 12-title preview QA passed.');
  } finally {
    globalThis.fetch = originalFetch;
  }
}
void verifyPreviews().catch((error: unknown) => { throw error; });
