import assert from 'node:assert/strict';
import type { MovieDetails, SeriesDetails } from '../api/catalogue';
import { hydrateSearchableReview, matchesProfileReview, reviewFallback, type ProfileReview } from './profileReviewsModel';
import { clearMemoryResourcesWithPrefix, setMemoryResource } from '../cache/memoryResourceCache';
import { getCachedProfileReviews, PROFILE_REVIEWS_CACHE_TTL_MS } from './profileReviewsCache';

async function run() {
  const review: ProfileReview = { type: 'movieReview', id: 'old-review', body: 'Une scène mémorable.', score: 4, updatedAt: '2020-01-01', content: { contentType: 'movie', tmdbId: 1 } };
  const movie = { title: 'Arrival', originalTitle: 'Arrival', posterUrl: null, cast: [], castNames: ['Amy Adams', 'Supporting Actor'], directors: ['Denis Villeneuve'], keywords: ['alien'] } as unknown as MovieDetails;
  const series = { title: 'Breaking Bad', originalTitle: null, posterUrl: null, cast: [], castNames: ['Bryan Cranston'], createdBy: [], keywords: [] } as unknown as SeriesDetails;
  const item = await hydrateSearchableReview(review, async () => movie, async () => series);
  for (const query of ['', '   ', 'ARRIVAL', 'amy adams', 'supporting actor', 'scene memorable', 'arrival amy', 'villeneuve', 'alien']) {
    assert.equal(matchesProfileReview(item, query), true, query);
  }
  assert.equal(matchesProfileReview(item, 'arrival missing'), false);
  const failed = await hydrateSearchableReview(review, async () => { throw new Error('offline'); }, async () => series);
  assert.equal(failed.id, review.id);
  assert.equal(failed.metadataUnavailable, true);
  assert.equal(matchesProfileReview(failed, 'memorable'), true);
  assert.equal(reviewFallback(review).body, review.body);
  const episode: ProfileReview = { ...review, type: 'episodeReview', content: { contentType: 'episode', seriesTmdbId: 2, seasonNumber: 1, episodeNumber: 3 } };
  const hydratedEpisode = await hydrateSearchableReview(episode, async () => movie, async () => series, async () => ({ item: { title: 'Guest episode', cast: [{ name: 'Guest Actor' }] } }) as never);
  assert.equal(matchesProfileReview(hydratedEpisode, 'guest actor'), true);
  assert.equal(matchesProfileReview(hydratedEpisode, 'breaking bryan'), true);
  assert.equal(hydratedEpisode.metadataUnavailable, false);
  const now = Date.parse('2026-09-09T10:00:00Z');
  const key = 'watchly:user:viewer:profile:reviews:author:0:0:0:v1';
  const snapshot = { items: [item, hydratedEpisode], hydratedCount: 1 };
  setMemoryResource(key, snapshot, new Date(now).toISOString());
  assert.equal(getCachedProfileReviews(key, now + 60_000)?.data, snapshot, 'returning to the screen reuses the hydrated snapshot');
  assert.equal(getCachedProfileReviews(key, now + 120_000)?.data.hydratedCount, 1, 'interrupted enrichment resumes after completed cards');
  assert.equal(getCachedProfileReviews(key, now + PROFILE_REVIEWS_CACHE_TTL_MS - 1)?.data, snapshot);
  assert.equal(getCachedProfileReviews(key, now + PROFILE_REVIEWS_CACHE_TTL_MS), null, 'repeated reads do not extend the five-minute TTL');
  assert.equal(getCachedProfileReviews(key.replace('viewer', 'another-viewer'), now), null, 'accounts cannot share review snapshots');
  assert.equal(getCachedProfileReviews(key.replace('author', 'another-author'), now), null, 'profiles have separate snapshots');
  assert.equal(getCachedProfileReviews(key.replace('0:0:0', '0:0:1'), now), null, 'a data or privacy revision invalidates the snapshot');
  clearMemoryResourcesWithPrefix('watchly:user:viewer:');
  assert.equal(getCachedProfileReviews(key, now), null, 'sign-out clearing removes the review snapshot');
  console.log('Profile reviews search QA passed.');
}
void run().catch((error) => { console.error(error); process.exitCode = 1; });
