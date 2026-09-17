// @ts-expect-error QA executes under tsx/Node.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getWatchlistCoverItems, toggleWatchlistCoverItem } from './watchlistCover';

const items = Array.from({ length: 20 }, (_, index) => ({ id: String(index), contentType: index % 2 ? 'series' : 'movie' }));
assert.deepEqual(getWatchlistCoverItems(items), items.slice(0, 4));
for (let count = 1; count <= 4; count++) {
  const ids = ['19', '2', '13', '4'].slice(0, count);
  assert.deepEqual(getWatchlistCoverItems(items, ids).map((item) => item.id), ids);
}
assert.deepEqual(getWatchlistCoverItems(items, ['deleted', '19']).map((item) => item.id), ['19']);
assert.deepEqual(getWatchlistCoverItems(items, ['deleted']), items.slice(0, 4));
assert.deepEqual(getWatchlistCoverItems([], ['deleted']), []);
let selected: string[] = [];
for (const id of ['1', '2', '3', '4', '5']) selected = toggleWatchlistCoverItem(selected, id);
assert.deepEqual(selected, ['1', '2', '3', '4']);
selected = toggleWatchlistCoverItem(selected, '2');
assert.deepEqual(toggleWatchlistCoverItem(selected, '5'), ['1', '3', '4', '5']);

const artworkButton = readFileSync(new URL('./WatchlistCoverButton.tsx', import.meta.url), 'utf8');
assert.match(artworkButton, /label="Change cover"/, 'The artwork modal must offer cover editing');
assert.match(artworkButton, /label="Change background"/, 'The artwork modal must offer background editing');
assert.match(artworkButton, /\/background[\s\S]*itemId: selected\[0\] \?\? null/, 'Background selection must persist one title or no title');

console.log('Watchlist cover and background selection QA passed.');
