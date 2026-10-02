// Node types are intentionally excluded from the Expo runtime config.
// @ts-expect-error QA executes under tsx/Node.
import assert from 'node:assert/strict';
import { loadProgressively } from '../watchlists/requestBoundaries';
import {
  getCachedMediaGenres,
  getMediaGenresKey,
  loadCachedMediaGenres,
  seedMediaGenres,
} from './mediaGenresCache';

async function run() {
  const movie = { contentType: 'movie' as const, tmdbId: 900001 };
  const series = { contentType: 'series' as const, tmdbId: movie.tmdbId };
  assert.notEqual(getMediaGenresKey(movie), getMediaGenresKey(series));
  seedMediaGenres(movie, ['Drama']);
  seedMediaGenres(series, ['Comedy']);
  assert.deepEqual(getCachedMediaGenres(movie), ['Drama']);
  assert.deepEqual(getCachedMediaGenres(series), ['Comedy'], 'movie and series IDs must stay distinct');

  const items = Array.from({ length: 500 }, (_, index) => ({
    contentType: 'movie' as const,
    tmdbId: 910000 + index,
  }));
  let requests = 0;
  let activeRequests = 0;
  let peakRequests = 0;
  const published: number[] = [];
  await loadProgressively({
    concurrency: 3,
    items,
    load: (item) => loadCachedMediaGenres(item, async () => {
      requests += 1;
      activeRequests += 1;
      peakRequests = Math.max(peakRequests, activeRequests);
      await Promise.resolve();
      activeRequests -= 1;
      return ['Drama'];
    }),
    onLoaded: (_, item) => published.push(item.tmdbId),
  });
  assert.equal(peakRequests, 3, 'a large filter collection must bound concurrent requests');
  assert.equal(published.length, 500, 'genre publication must cover every title');
  for (const item of items) {
    assert.deepEqual(getCachedMediaGenres(item), ['Drama'], 'reopening a large list must have immediate cached genres');
    await loadCachedMediaGenres(item, async () => { requests += 1; return ['Unexpected']; });
  }
  assert.equal(requests, 500, 'reopening 500 titles must not refetch evicted genre entries');

  let current = true;
  let cancellationRequests = 0;
  let cancellationPublications = 0;
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  const cancelledLoad = loadProgressively({
    concurrency: 3,
    items,
    isCurrent: () => current,
    load: async () => { cancellationRequests += 1; await pending; },
    onLoaded: () => { cancellationPublications += 1; },
  });
  current = false;
  finish();
  await cancelledLoad;
  assert.equal(cancellationRequests, 3, 'closing filters must stop scheduling more genre requests');
  assert.equal(cancellationPublications, 0, 'closed filters must not publish late genre results');

  const sharedItem = { contentType: 'series' as const, tmdbId: 920000 };
  let sharedRequests = 0;
  let resolve!: (genres: string[]) => void;
  const load = () => {
    sharedRequests += 1;
    return new Promise<string[]>((done) => { resolve = done; });
  };
  const first = loadCachedMediaGenres(sharedItem, load);
  const second = loadCachedMediaGenres(sharedItem, load);
  assert.equal(sharedRequests, 1, 'concurrent filter surfaces must coalesce genre requests');
  resolve(['Thriller']);
  assert.deepEqual(await first, ['Thriller']);
  assert.deepEqual(await second, ['Thriller']);

  const failedItem = { contentType: 'movie' as const, tmdbId: 920001 };
  await assert.rejects(loadCachedMediaGenres(failedItem, async () => { throw new Error('offline'); }));
  assert.equal(getCachedMediaGenres(failedItem), null, 'failures must not be cached as empty genres');
  assert.deepEqual(await loadCachedMediaGenres(failedItem, async () => ['Action']), ['Action']);

  const emptyItem = { contentType: 'movie' as const, tmdbId: 920002 };
  seedMediaGenres(emptyItem, []);
  assert.deepEqual(await loadCachedMediaGenres(emptyItem, async () => { throw new Error('must use cache'); }), []);

  const originalNow = Date.now;
  const now = originalNow();
  const expiringItem = { contentType: 'movie' as const, tmdbId: 920003 };
  try {
    Date.now = () => now;
    seedMediaGenres(expiringItem, ['Drama']);
    Date.now = () => now + 24 * 60 * 60 * 1000 - 1;
    assert.deepEqual(getCachedMediaGenres(expiringItem), ['Drama']);
    Date.now = () => now + 24 * 60 * 60 * 1000;
    assert.equal(getCachedMediaGenres(expiringItem), null, 'genre entries must expire after 24 hours');
    seedMediaGenres(expiringItem, ['Stale catalogue details']);
    assert.equal(getCachedMediaGenres(expiringItem), null, 'old catalogue details must not extend an expired entry');
    assert.deepEqual(await loadCachedMediaGenres(expiringItem, async () => ['Updated']), ['Updated']);
    assert.deepEqual(getCachedMediaGenres(expiringItem), ['Updated']);
  } finally {
    Date.now = originalNow;
  }

  console.log('Media genres cache QA passed.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
