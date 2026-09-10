import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { readCommunityCursor } from './community-feed';
import { followedShare, rankCommunity, type CommunityItem } from './community-ranking';

const now = new Date('2026-09-10T12:00:00Z');
function post(id: number, followed = false, author = `${followed ? 'followed' : 'public'}-${id}`): CommunityItem {
  return { id: String(id), author: { id: author, avatarUrl: null, displayName: author }, body: 'Review', content: { contentType: 'movie', tmdbId: id }, type: 'movieReview', score: 4, likeCount: 0, likedByViewer: false, updatedAt: now.toISOString(), followed, affinity: 0, viewerHasWatched: false, inWatchlist: false };
}
const discoveries = Array.from({ length: 250 }, (_, i) => post(i));
for (const [authors, share] of [[0, 0], [1, .05], [2, .15], [4, .15], [5, .25], [9, .25], [10, .4], [19, .4], [20, .5], [49, .5], [50, .55], [200, .55]]) {
  assert.equal(followedShare(authors), share);
  const followed = Array.from({ length: authors ? 200 : 0 }, (_, i) => post(1000 + i, true, `followed-${i % authors}`));
  const result = rankCommunity([...followed, ...discoveries], now, 100);
  assert.equal(result.length, 100);
  assert.equal(result.filter((item) => item.followed).length, Math.round(share * 100));
  for (let size = 1; size <= result.length; size++) {
    const prefix = result.slice(0, size);
    assert.ok(prefix.filter((item) => item.followed).length <= Math.floor(size * share + 1e-8));
    if (size > 1) assert.notEqual(result[size - 1].author.id, result[size - 2].author.id);
  }
}
const favorite = { ...post(900), affinity: 70, updatedAt: '2026-09-01T12:00:00Z' };
const popular = { ...post(901), likeCount: 1000000 };
assert.equal(rankCommunity([popular, favorite], now)[0].id, favorite.id, 'Personal interests outrank raw popularity');
assert.deepEqual(rankCommunity(discoveries, now), rankCommunity([...discoveries].reverse(), now), 'Stable tie-breaking');
const inactive = Array.from({ length: 100 }, (_, i) => ({ ...post(1000 + i, true), updatedAt: '2026-07-01T12:00:00Z' }));
assert.equal(rankCommunity([...inactive, ...discoveries], now).filter((item) => item.followed).length, 0, 'Inactive follows do not raise the quota');
const activity = Array.from({ length: 100 }, (_, i) => ({ ...post(1000 + i, true), type: 'viewing' as const }));
const mixed = rankCommunity([...activity, ...discoveries, { ...post(9999), type: 'viewing' }], now, 100);
assert.ok(mixed.some((item) => item.type === 'viewing'));
assert.ok(mixed.filter((item) => item.type === 'viewing').length <= 10);
assert.ok(mixed.every((item) => item.type !== 'viewing' || item.followed));
assert.throws(() => readCommunityCursor('garbage'), BadRequestException);
assert.throws(() => readCommunityCursor(Buffer.from(JSON.stringify({ at: now.toISOString(), offset: -1 })).toString('base64url')), BadRequestException);
const loneFollow = Array.from({ length: 6 }, (_, i) => post(2000 + i, true, 'only-follow'));
assert.equal(rankCommunity(loneFollow, now).length, 6, 'A sole followed author must not leave For you empty');
assert.equal(rankCommunity([...loneFollow, post(3000)], now).length, 7, 'Sparse discovery must not prevent filling with followed opinions');
assert.equal(rankCommunity([post(1, false, 'one'), post(2, false, 'one')], now).length, 2, 'Author diversity must not discard the only available discoveries');
const followingOnly = rankCommunity([...loneFollow, ...discoveries], now, 150, 'following');
assert.equal(followingOnly.length, 6);
assert.ok(followingOnly.every((item) => item.followed), 'Following must never include discovery');
assert.equal(rankCommunity(discoveries, now, 150, 'following').length, 0);
assert.equal(rankCommunity([{ ...post(7, true), type: 'viewing' }], now).length, 1, 'A lone followed viewing may fill an otherwise empty feed');
assert.throws(() => readCommunityCursor(Buffer.from(JSON.stringify({ at: now.toISOString(), offset: 30, mode: 'following' })).toString('base64url')), BadRequestException);
console.log('Community ranking QA passed: quotas, active authors, interests, diversity, activity limits and cursors.');
