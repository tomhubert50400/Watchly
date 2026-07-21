// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
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
const response = {
  items: [movieRating, movieReview],
  stats: { followersCount: 7, followingCount: 3, postsCount: 2, reviewsCount: 1 },
} as ProfileOpinionsResponse & { stats: { followingCount: number } };
const publicProfile: UserProfile = {
  displayName: 'Watchly UI Review',
  id: 'user-1',
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
assert.equal(publicModel.displayName, 'Watchly UI Review');
assert.deepEqual(publicModel.opinions, [movieRating, movieReview]);
assert.deepEqual(publicModel.stats, {
  followersCount: 7,
  followingCount: 3,
  ratingsCount: 2,
  reviewsCount: 1,
});
const presentation = {
  authorDisplayName: 'Watchly UI Review',
  contentImageUrl: 'https://image.example/matrix.jpg',
  contentSubtitle: 'Movie',
  contentTitle: 'The Matrix',
  seriesTitle: null,
};
assert.deepEqual(getProfileOpinionTarget(movieReview, presentation), {
  name: 'ReviewDetail',
  params: {
    authorDisplayName: 'Watchly UI Review',
    body: 'A precise, stylish rewatch.',
    contentImageUrl: 'https://image.example/matrix.jpg',
    contentSubtitle: 'Movie',
    contentTitle: 'The Matrix',
    rating: 4.5,
    target: { contentType: 'movie', tmdbId: 603 },
    updatedAt: '2026-07-09T12:00:00.000Z',
  },
});
assert.deepEqual(getProfileOpinionTarget(movieRating, presentation), {
  name: 'FilmDetail',
  params: { title: 'The Matrix', tmdbId: 603 },
});

const privateRatingsModel = buildProfileModel(
  { ...publicProfile, privacy: { ...publicProfile.privacy, ratingsVisibility: 'private' } },
  response,
);
assert.deepEqual(
  privateRatingsModel.opinions.map((opinion) => opinion.type),
  ['movieReview'],
  'private standalone ratings must not be presented as public activity',
);
assert.equal(privateRatingsModel.stats.ratingsCount, 1, 'the public review still carries its published rating');

const privateProfileModel = buildProfileModel(
  { ...publicProfile, privacy: { ...publicProfile.privacy, profileVisibility: 'private' } },
  response,
);
assert.deepEqual(
  privateProfileModel.opinions.map((opinion) => opinion.type),
  ['movieRating'],
  'private written reviews must stay off the public-facing profile',
);
assert.equal(privateProfileModel.stats.reviewsCount, 0);

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
assert.deepEqual(fullyPrivateModel.opinions, []);
assert.equal(fullyPrivateModel.stats.followersCount, 7, 'real social stats remain available without exposing opinions');

console.log('Profile model QA passed.');
