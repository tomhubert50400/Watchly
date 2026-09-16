import assert from 'node:assert/strict';
import { getRatingDistribution } from './ratingDistribution';
import type { MovieCommunityResponse } from '../api/reviews';

const community: MovieCommunityResponse = {
  averageScore: null, ratingCount: 0, reviewCount: 0, reviews: [], nextPage: null,
  distribution: Array.from({ length: 10 }, (_, i) => ({ score: (i + 1) / 2, count: 0 })),
};
for (const count of [1, 2, 9, 777, 2000000]) {
  for (let step = 10; step <= 100; step += 1) {
    const rating = { source: 'tmdb' as const, scale: 10 as const, average: step / 10, count };
    const result = getRatingDistribution(community, rating);
    assert.equal(result.estimated, true);
    assert.equal(result.distribution.length, 10);
    assert.equal(result.distribution.reduce((sum, b) => sum + b.count, 0), count);
    assert(result.distribution.every(b => Number.isInteger(b.count) && b.count >= 0));
    const weightedSum = result.distribution.reduce((sum, b) => sum + b.count * b.score * 2, 0);
    assert.equal(weightedSum, Math.round(rating.average * count));
    assert.deepEqual(getRatingDistribution(community, rating), result);
    assert.equal(result.reviews, community.reviews);
  }
}
const tmdb = { source: 'tmdb' as const, scale: 10 as const, average: 6.7, count: 777 };
assert.equal(getRatingDistribution({ ...community, ratingCount: 99 }, tmdb).estimated, true);
const real = { ...community, ratingCount: 100, averageScore: 4 };
assert.equal(getRatingDistribution(real, tmdb).estimated, false);
assert.equal(getRatingDistribution(real, tmdb).distribution, real.distribution);
assert.equal(getRatingDistribution(community, { ...tmdb, source: 'watchly' }).estimated, false);
for (const rating of [null, { ...tmdb, count: 0 }, { ...tmdb, count: null }, { ...tmdb, average: NaN }]) {
  assert.equal(getRatingDistribution(community, rating).estimated, false);
}
console.log('Rating distribution QA passed: totals, mean, determinism, boundaries and real-data switch.');
