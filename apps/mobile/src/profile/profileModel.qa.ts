// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import type { ProfileOpinion, ProfileOpinionsResponse, UserProfile } from '../api/profile';
import { buildProfileModel, getProfileOpinionTarget } from './profileModel';

const movieRating: ProfileOpinion = {
  content: { contentType: 'movie', tmdbId: 603 },
  id: 'rating-public',
  score: 4.5,
  type: 'movieRating',
  updatedAt: '2026-07-10T12:00:00.000Z',
};
const movieReview: ProfileOpinion = {
  body: 'A precise, stylish rewatch.',
  content: { contentType: 'movie', tmdbId: 603 },
  id: 'review-public',
  score: 4.5,
  type: 'movieReview',
  updatedAt: '2026-07-09T12:00:00.000Z',
};
const episodeReview: ProfileOpinion = {
  body: 'A perfect bottle episode.',
  content: { contentType: 'episode', episodeNumber: 7, seasonNumber: 2, seriesTmdbId: 1396 },
  id: 'episode-review-public',
  score: 5,
  type: 'episodeReview',
  updatedAt: '2026-07-08T12:00:00.000Z',
};
const response = {
  items: [movieRating, movieReview],
  stats: { followersCount: 7, followingCount: 3, postsCount: 2, reviewsCount: 1 },
} as ProfileOpinionsResponse & { stats: { followingCount: number } };
const publicProfile: UserProfile = {
  avatarUploadsEnabled: true,
  avatarUrl: 'https://images.watchly.test/avatars/user-1/photo.jpg',
  displayName: 'Watchly UI Review',
  handle: 'watchly_ui_review',
  id: 'user-1',
  providerAvatarImportEnabled: true,
  profileBackdrop: { contentType: 'series', tmdbId: 1396 },
  privacy: {
    episodeProgressVisibility: 'private',
    profileVisibility: 'public',
    ratingsVisibility: 'public',
    reviewsFollowProfileVisibility: true,
    sharedWatchlistVisibility: 'members',
    viewingHistoryVisibility: 'private',
  },
};

const publicModel = buildProfileModel(publicProfile, response);
assert.equal(publicModel.avatarUploadsEnabled, true);
assert.equal(publicModel.avatarUrl, publicProfile.avatarUrl);
assert.equal(publicModel.displayName, 'Watchly UI Review');
assert.equal(publicModel.handle, 'watchly_ui_review');
assert.deepEqual(publicModel.opinions, [movieRating, movieReview]);
assert.equal(publicModel.providerAvatarImportEnabled, true);
assert.deepEqual(publicModel.profileBackdrop, publicProfile.profileBackdrop);
assert.deepEqual(publicModel.stats, {
  followersCount: 7,
  followingCount: 3,
  ratingsCount: 2,
  reviewsCount: 1,
});
const presentation = {
  contentTitle: 'The Matrix',
  seriesTitle: null,
};
assert.deepEqual(getProfileOpinionTarget(movieReview, presentation), {
  name: 'FilmDetail',
  params: { title: 'The Matrix', tmdbId: 603 },
});
assert.deepEqual(getProfileOpinionTarget(movieRating, presentation), {
  name: 'FilmDetail',
  params: { title: 'The Matrix', tmdbId: 603 },
});
assert.deepEqual(
  getProfileOpinionTarget(episodeReview, { contentTitle: 'Better Call Saul', seriesTitle: 'Breaking Bad' }),
  {
    name: 'EpisodeDetail',
    params: {
      episodeNumber: 7,
      seasonNumber: 2,
      seriesTitle: 'Breaking Bad',
      title: 'Better Call Saul',
      tmdbId: 1396,
    },
  },
);
assert.throws(
  () => getProfileOpinionTarget(episodeReview, { contentTitle: 'Better Call Saul', seriesTitle: null }),
  /real series title/,
);

for (const sourceUrl of [new URL('./ProfileScreen.tsx', import.meta.url), new URL('../feed/FeedScreen.tsx', import.meta.url)]) {
  const source = readFileSync(sourceUrl, 'utf8');
  assert.equal(
    source.includes('Series ${'),
    false,
    `${sourceUrl.pathname} must never render a series TMDB id as its title`,
  );
}

const privateRatingsModel = buildProfileModel(
  { ...publicProfile, privacy: { ...publicProfile.privacy, ratingsVisibility: 'private' } },
  response,
);
assert.deepEqual(
  privateRatingsModel.opinions,
  [movieRating, movieReview],
  'legacy sub-settings must not split the single profile visibility choice',
);

const privateProfileModel = buildProfileModel(
  { ...publicProfile, privacy: { ...publicProfile.privacy, profileVisibility: 'private' } },
  response,
);
assert.deepEqual(
  privateProfileModel.opinions,
  [movieRating, movieReview],
  'owners must keep seeing every opinion when their profile is private',
);
assert.equal(privateProfileModel.stats.reviewsCount, 1);
assert.equal(privateProfileModel.stats.ratingsCount, 2);
assert.equal(privateProfileModel.isPublic, false);

const fullyPrivateModel = buildProfileModel(
  {
    ...publicProfile,
    privacy: {
      ...publicProfile.privacy,
      profileVisibility: 'private',
      ratingsVisibility: 'private',
    },
  },
  response,
);
assert.deepEqual(fullyPrivateModel.opinions, [movieRating, movieReview]);
assert.equal(fullyPrivateModel.stats.followersCount, 7, 'real social stats remain available without exposing opinions');

console.log('Profile model QA passed.');
