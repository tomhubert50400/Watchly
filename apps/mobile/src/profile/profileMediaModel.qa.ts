// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import type { LibraryMediaItem } from '../library/useLibraryData';
import {
  getProfileMediaItems,
  getProfileMediaPreviews,
  getProfileMediaStatus,
  groupProfileMediaByStatus,
  isProfileBackdropCandidate,
} from './profileMediaModel';

function media(
  key: string,
  overrides: Partial<LibraryMediaItem> = {},
): LibraryMediaItem {
  const [contentType, rawTmdbId] = key.split(':');

  return {
    backdropUrl: null,
    contentType: contentType as LibraryMediaItem['contentType'],
    favorite: false,
    hasReleaseAlert: false,
    inferredWatchingFromProgress: false,
    key,
    lastWatchedAt: null,
    numberOfEpisodes: contentType === 'series' ? 20 : null,
    posterUrl: null,
    ratingScore: null,
    resumeEpisodeNumber: null,
    resumeSeasonNumber: null,
    status: null,
    title: key,
    tmdbId: Number(rawTmdbId),
    updatedAt: '2026-08-01T00:00:00.000Z',
    watchedEpisodeCount: 0,
    ...overrides,
  };
}

assert.equal(
  getProfileMediaStatus(media('movie:1', { favorite: true, status: 'watching' })),
  'planned',
  'movies must not expose an in-progress state',
);
assert.equal(
  getProfileMediaStatus(media('movie:8', { status: 'watching' })),
  null,
  'a movie Watching state without a favorite or alert must not be shown',
);
assert.equal(
  getProfileMediaStatus(media('movie:2', { hasReleaseAlert: true, status: 'watched' })),
  'completed',
  'completed titles must take priority over release alerts',
);
assert.equal(
  getProfileMediaStatus(media('series:3', { favorite: true, watchedEpisodeCount: 4 })),
  'inProgress',
  'episode progress must infer an in-progress series',
);
assert.equal(
  getProfileMediaStatus(media('series:4', { numberOfEpisodes: 8, watchedEpisodeCount: 8 })),
  'completed',
  'complete episode progress must infer a completed series',
);
assert.equal(getProfileMediaStatus(media('movie:5', { favorite: true })), 'planned');
assert.equal(getProfileMediaStatus(media('series:6', { hasReleaseAlert: true })), 'planned');
assert.equal(
  getProfileMediaStatus(media('movie:7', { status: 'watchlisted' })),
  'planned',
  'Want to watch titles must appear in Planned',
);
assert.equal(
  isProfileBackdropCandidate(media('movie:7', { status: 'watchlisted' })),
  false,
  'Want to watch alone must not become a profile backdrop',
);

const recent = Array.from({ length: 12 }, (_, index) => media(`movie:${index + 10}`, {
  favorite: index % 2 === 0,
  hasReleaseAlert: index % 2 !== 0,
  updatedAt: `2026-08-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
}));
const previews = getProfileMediaPreviews(recent);
assert.equal(previews.movies.length, 10, 'profile rails must contain at most ten titles');
assert.equal(previews.movies[0]?.tmdbId, 21, 'profile rails must show the most recent title first');

const mixed = [
  media('movie:30', { favorite: true, status: 'watched' }),
  media('movie:31', { favorite: true, status: 'watching' }),
  media('series:32', { favorite: true }),
  media('series:33', { favorite: true, status: 'watching' }),
];
assert.deepEqual(
  getProfileMediaItems(mixed, 'favorites').map((item) => item.tmdbId),
  [30, 31, 32, 33],
);
const grouped = groupProfileMediaByStatus(mixed);
assert.deepEqual(grouped.completed.map((item) => item.tmdbId), [30]);
assert.deepEqual(grouped.inProgress.map((item) => item.tmdbId), [33]);
assert.deepEqual(grouped.planned.map((item) => item.tmdbId), [31, 32]);

const profileSource = readFileSync(new URL('./ProfileScreen.tsx', import.meta.url), 'utf8');
const profileBodySource = readFileSync(new URL('./ProfileBody.tsx', import.meta.url), 'utf8');
const publicProfileSource = readFileSync(
  new URL('./PublicProfileScreen.tsx', import.meta.url),
  'utf8',
);
const mediaRailSource = readFileSync(new URL('./ProfileMediaRail.tsx', import.meta.url), 'utf8');
const allTimeStatsSource = readFileSync(new URL('./AllTimeStatsScreen.tsx', import.meta.url), 'utf8');
assert.equal(
  profileBodySource.includes('ViewingHighlightCard'),
  false,
  'the Biggest Obsession card must be removed from Profile',
);
for (const title of ['Series', 'Movies', 'Favorites']) {
  assert(
    profileBodySource.includes(`title="${title}"`),
    `the shared Profile body must include the ${title} media rail`,
  );
}
assert.equal(
  profileBodySource.match(/style={styles\.statsDivider}/g)?.length,
  2,
  'the shared Profile body must separate Your Stats from both adjacent sections',
);
assert(
  profileSource.includes('accessibilityLabel="Choose profile background"'),
  'Profile must expose a small accessible background picker button',
);
assert(
  profileSource.includes("navigation.navigate('AllTimeStats', { profileBackdropUrl: atmosphereUrl })"),
  'Profile must pass its resolved background into the All Time screen',
);
assert(
  profileSource.includes('<ProfileBody') && publicProfileSource.includes('<ProfileBody'),
  'owner and public profiles must render through the same Profile body',
);
assert(
  publicProfileSource.includes('<SpotlightAtmosphere fadeIn imageUrl={atmosphereUrl} />')
    && publicProfileSource.includes('followingCount={profile.stats.followingCount}')
    && publicProfileSource.includes('items: mediaItems')
    && publicProfileSource.includes('stats: profile.viewingStats'),
  'public profiles must preserve the owner atmosphere, identity stats, media pages, and All Time route',
);
assert(
  publicProfileSource.includes('<ProfileSummaryCard')
    && publicProfileSource.includes('followersCount={followersCount}')
    && publicProfileSource.includes('followingCount={profile.stats.followingCount}')
    && publicProfileSource.includes('This profile is private'),
  'private profiles must retain the shared identity header and explain why activity is hidden',
);
const toggleFollowSource = publicProfileSource.slice(
  publicProfileSource.indexOf('async function toggleFollow()'),
  publicProfileSource.indexOf('const shareProfile'),
);
assert.match(
  toggleFollowSource,
  /setFollowState\(optimisticFollowState\);[\s\S]*await (?:unfollowUser|followUser)/,
  'follow changes must update the visible state before waiting for the API',
);
assert.doesNotMatch(
  toggleFollowSource,
  /getPublicProfile|hydrateLoadedProfile|isUpdatingFollow/,
  'follow changes must not reload the public profile or expose a pending frontend state',
);
assert.match(
  toggleFollowSource,
  /setFollowersCountOverride\(Math\.max\(0, followersCount \+ followerCountDelta\)\)/,
  'follow counts must update without replacing the loaded profile object',
);
assert.doesNotMatch(
  toggleFollowSource,
  /setProfile\(\(current\)/,
  'follow counts must not invalidate profile media hydration',
);
assert.match(
  toggleFollowSource,
  /setFollowState\(previousFollowState\);[\s\S]*setProfile\(previousProfile\)/,
  'failed follow changes must restore the previous visible state',
);
assert(
  mediaRailSource.includes('alwaysBounceVertical={false}')
    && mediaRailSource.includes('directionalLockEnabled'),
  'profile media rails must stay locked to horizontal card movement',
);
assert(
  allTimeStatsSource.includes('route.params?.profileBackdropUrl')
    && allTimeStatsSource.includes('<SpotlightAtmosphere imageUrl={atmosphereUrl} />'),
  'All Time must render the same profile backdrop through the shared atmosphere',
);
const backdropPickerSource = readFileSync(
  new URL('./ProfileBackdropPickerSheet.tsx', import.meta.url),
  'utf8',
);
assert(
  backdropPickerSource.includes('<BottomActionSheetScrollView'),
  'the background picker must remain scrollable without blocking swipe-down dismissal',
);
assert(
  backdropPickerSource.includes('title="Series"')
    && backdropPickerSource.includes('title="Movies"'),
  'the background picker must segment eligible profile series and movies',
);
const profileApiSource = readFileSync(new URL('../api/profile.ts', import.meta.url), 'utf8');
assert(
  profileApiSource.includes("'/profile/me/backdrop'"),
  'the selected background must persist through the profile API',
);
const mediaScreenSource = readFileSync(new URL('./ProfileMediaScreen.tsx', import.meta.url), 'utf8');
assert(
  mediaScreenSource.includes("route.params.filter !== 'movies'"),
  'movie pages must hide the In progress section',
);
for (const title of ['In progress', 'Planned', 'Completed']) {
  assert(
    mediaScreenSource.includes(`title="${title}"`),
    `Profile media pages must include the ${title} section`,
  );
}
const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const allTimeComponentIndex = appSource.indexOf('component={AllTimeStatsScreen}');
const allTimeRouteStart = appSource.lastIndexOf('<Stack.Screen', allTimeComponentIndex);
const allTimeRouteSource = appSource.slice(
  allTimeRouteStart,
  appSource.indexOf('<Stack.Screen', allTimeComponentIndex + 1),
);
assert(
  appSource.includes('headerTransparent: true'),
  'Profile media pages must let their blurred background continue behind the native header',
);
assert(
  allTimeRouteSource.includes('headerTransparent: true'),
  'All Time must let the profile backdrop continue behind its native header',
);

console.log('Profile media model QA passed.');
