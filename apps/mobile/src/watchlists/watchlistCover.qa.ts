// @ts-expect-error QA executes under tsx/Node.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getWatchlistCoverItems, toggleWatchlistCoverItem } from './watchlistCover';
import { saveWatchlistArtwork } from './saveWatchlistArtwork';

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

const artworkButton = readFileSync(new URL('./WatchlistArtworkSheet.tsx', import.meta.url), 'utf8');
const personalScreen = readFileSync(new URL('./PersonalWatchlistScreen.tsx', import.meta.url), 'utf8');
const sharedScreen = readFileSync(new URL('./SharedWatchlistScreen.tsx', import.meta.url), 'utf8');
assert.match(artworkButton, /<SegmentedControl[\s\S]*label: 'Change cover'[\s\S]*label: 'Change background'/, 'The artwork modal must switch modes with the shared segmented control');
assert.match(artworkButton, /mode === 'cover'[\s\S]*media\.backdropUrl \?\? media\.posterUrl[\s\S]*media\.posterUrl \?\? media\.backdropUrl/, 'Cover choices must prefer landscape artwork and background choices must prefer portraits');
assert.match(artworkButton, /mode === 'cover' \? styles\.coverArtwork : styles\.backgroundArtwork/, 'Cover and background choices must use landscape and portrait aspect ratios');
assert.match(artworkButton, /backgroundItemId: backgroundSelection\[0\] \?\? null/, 'Background selection must persist one title or no title independently of the active tab');
for (const screen of [personalScreen, sharedScreen]) {
  assert.match(screen, /backgroundItem\?\.posterUrl \?\? backgroundItem\?\.backdropUrl/, 'The saved background must render the selected portrait artwork');
  assert.match(screen, /headerTransparent: Boolean\(backgroundUrl\)/, 'The selected background must extend behind the native header');
}

async function verifyArtworkSave() {
  const saved = { coverItemIds: ['1'], backgroundItemId: '2' as string | null };
  const selected = { coverItemIds: ['4', '3'], backgroundItemId: '5' as string | null };
  const calls: string[] = [];
  const updates: unknown[] = [];
  let failBackground = true;
  let current = true;
  const options = {
    saved,
    selected,
    isCurrent: () => current,
    saveCover: async (ids: string[]) => { calls.push('cover'); return { coverItemIds: ids }; },
    saveBackground: async (id: string | null) => {
      calls.push('background');
      if (failBackground) throw new Error('offline');
      return { backgroundItemId: id };
    },
    onSaved: (change: unknown) => { updates.push(change); },
  };
  await assert.rejects(saveWatchlistArtwork(options), /offline/);
  assert.deepEqual(calls, ['cover', 'background'], 'one save must attempt both changed selections');
  assert.deepEqual(saved, { coverItemIds: ['4', '3'], backgroundItemId: '2' }, 'a partial failure must retain the successful cover');
  failBackground = false;
  await saveWatchlistArtwork(options);
  assert.deepEqual(calls, ['cover', 'background', 'background'], 'retry must only save the outstanding change');
  assert.deepEqual(saved, selected);
  assert.deepEqual(updates, [{ coverItemIds: ['4', '3'] }, { backgroundItemId: '5' }]);
  await saveWatchlistArtwork(options);
  assert.equal(calls.length, 3, 'unchanged selections must not be written');
  await saveWatchlistArtwork({ ...options, selected: { coverItemIds: [], backgroundItemId: null } });
  assert.deepEqual(saved, { coverItemIds: [], backgroundItemId: null }, 'automatic cover and removed background must both persist');
  selected.coverItemIds = ['3', '4'];
  current = false;
  await saveWatchlistArtwork(options);
  assert.equal(calls.length, 5, 'closing the sheet or changing accounts must stop writes');
  current = true;
  await saveWatchlistArtwork({
    ...options,
    saveCover: async (ids) => { current = false; return { coverItemIds: ids }; },
  });
  assert.equal(calls.length, 5, 'an account change during a save must stop the background request');
  assert.deepEqual(saved, { coverItemIds: [], backgroundItemId: null }, 'stale save results must not update the active account');
  assert.match(artworkButton, /label="Save cover & background"/, 'both tabs must expose the same combined save');
  assert.match(artworkButton, /selected: \{ coverItemIds: coverSelection, backgroundItemId: backgroundSelection\[0\] \?\? null \}/,
    'the active tab must not control which selection is saved');
  console.log('Watchlist artwork QA passed: both selections, partial failure, retry, unchanged selections, removal and account changes.');
}

void verifyArtworkSave().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
