import assert from 'node:assert/strict';
import {
  TrackedContentType,
  UserContentStatus,
} from '../generated/prisma/enums';
import {
  isProfileBackdropEligible,
  normalizeProfileBackdropInput,
  toApiProfileBackdrop,
} from './profile-backdrop';

const movie = normalizeProfileBackdropInput({ contentType: 'movie', tmdbId: 603 });
assert.deepEqual(movie, { contentType: TrackedContentType.MOVIE, tmdbId: 603 });
assert.equal(normalizeProfileBackdropInput({ contentType: null, tmdbId: null }), null);
assert.throws(() => normalizeProfileBackdropInput({ contentType: 'series' }), /both/);
assert.throws(() => normalizeProfileBackdropInput({ contentType: 'movie', tmdbId: 0 }), /valid/);
assert.deepEqual(toApiProfileBackdrop(TrackedContentType.SERIES, 1399), {
  contentType: 'series',
  tmdbId: 1399,
});

if (!movie) throw new Error('Movie selection fixture is required.');
assert.equal(isProfileBackdropEligible({
  favorite: true,
  hasEpisodeProgress: false,
  hasReleaseAlert: false,
  selection: movie,
  status: UserContentStatus.WATCHING,
}), true);
assert.equal(isProfileBackdropEligible({
  favorite: false,
  hasEpisodeProgress: false,
  hasReleaseAlert: false,
  selection: movie,
  status: UserContentStatus.WATCHING,
}), false, 'a movie Watching state alone is not visible on Profile');

const series = normalizeProfileBackdropInput({ contentType: 'series', tmdbId: 1399 });
if (!series) throw new Error('Series selection fixture is required.');
assert.equal(isProfileBackdropEligible({
  favorite: false,
  hasEpisodeProgress: true,
  hasReleaseAlert: false,
  selection: series,
  status: null,
}), true);
assert.equal(isProfileBackdropEligible({
  favorite: false,
  hasEpisodeProgress: false,
  hasReleaseAlert: false,
  selection: series,
  status: UserContentStatus.WATCHLISTED,
}), false, 'a legacy watchlist state alone is not visible on Profile');

console.log('Profile backdrop QA passed.');
