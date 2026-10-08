// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import type { LibraryMediaItem } from '../library/useLibraryData';
import { mergeLibraryItems } from '../library/libraryModel';
import {
  getProfileMediaItems,
  getProfileMediaPreviews,
  getProfileMediaStatus,
  groupProfileMediaByStatus,
  isProfileBackdropCandidate,
  moveFavorite,
  resolveFavoriteDropTarget,
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
for (const watchedEpisodeCount of [0, 4, 20]) {
  assert.equal(
    getProfileMediaStatus(media('series:7', { status: 'watchlisted', watchedEpisodeCount })),
    'planned',
    'explicit planning must appear in Planned regardless of previous episode progress',
  );
}
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
const orderedFavorites = [
  media('movie:1', { favorite: true, favoritePosition: 1, updatedAt: '2026-09-28' }),
  media('series:1', { favorite: true, favoritePosition: 0, updatedAt: '2026-01-01' }),
  media('movie:2', { favorite: true, updatedAt: '2026-09-29' }),
  media('movie:3', { favorite: false, favoritePosition: 0 }),
];
assert.deepEqual(getProfileMediaItems(orderedFavorites, 'favorites').map((item) => item.key),
  ['series:1', 'movie:1', 'movie:2'], 'saved favorite order must win over activity dates, with new favorites at the end');
assert.equal(getProfileMediaItems(orderedFavorites, 'movies')[0]?.key, 'movie:2', 'ordering favorites must not reorder other rails');
assert.deepEqual(moveFavorite(['a', 'b', 'c', 'd'], 0, 3), ['b', 'c', 'd', 'a']);
assert.deepEqual(moveFavorite(['a', 'b', 'c', 'd'], 3, 0), ['d', 'a', 'b', 'c']);
assert.deepEqual(moveFavorite(['a', 'b', 'c'], 1, 1), ['a', 'b', 'c']);
const dropTargets = [
  { key: 'a', x: 0, y: 0, width: 100, height: 180 },
  { key: 'b', x: 110, y: 0, width: 100, height: 180 },
  { key: 'c', x: 220, y: 0, width: 100, height: 180 },
  { key: 'd', x: 0, y: 190, width: 100, height: 180 },
];
const dropBounds = { width: 320, height: 434 };
for (const point of [{ x: 50, y: 250 }, { x: 200, y: 250 }, { x: 200, y: 410 }]) {
  const key = resolveFavoriteDropTarget(point, dropTargets, dropBounds);
  assert.equal(key, 'd', 'the last card and trailing empty grid space must resolve to the final position');
  const order = dropTargets.map((item) => item.key);
  assert.deepEqual(moveFavorite(order, 0, order.indexOf(key!)), ['b', 'c', 'd', 'a'],
    'dropping first at the end must shift every following card forward, not swap cards');
}
assert.equal(resolveFavoriteDropTarget({ x: 250, y: 410 }, dropTargets.slice(0, 3), dropBounds), 'c', 'dropping below a full final row must append');
assert.equal(resolveFavoriteDropTarget({ x: 150, y: 50 }, dropTargets, dropBounds), 'b');
assert.equal(resolveFavoriteDropTarget({ x: 105, y: 50 }, dropTargets, dropBounds), null, 'earlier gaps must not append');
assert.equal(resolveFavoriteDropTarget({ x: 321, y: 250 }, dropTargets, dropBounds), null);
assert.equal(resolveFavoriteDropTarget({ x: 50, y: 435 }, dropTargets, dropBounds), null, 'dropping outside the grid must cancel');
assert.equal(resolveFavoriteDropTarget({ x: 50, y: 50 }, [], dropBounds), null);
const favoriteEditorSource = readFileSync(new URL('./FavoriteOrderEditor.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(favoriteEditorSource, /Save order|onSave|disabled=/,
  'favorite ordering must not require a save button or block leaving while saving');
assert.match(favoriteEditorSource, /onRequestClose=\{onClose\}/);
assert.match(favoriteEditorSource, /label="Done" onPress=\{onClose\}/);
assert.match(favoriteEditorSource, /setDraft\(ordered\);\s*onChange\(ordered\)/,
  'dropping must update the visible order and schedule persistence immediately');
const watchlistScreenSource = readFileSync(new URL('../watchlists/PersonalWatchlistScreen.tsx', import.meta.url), 'utf8');
for (const animation of ['dragScale', 'dragTilt']) {
  const spring = new RegExp(`Animated\\.spring\\(${animation},\\s*\\{([^}]+)\\}`);
  const favoriteSpring = favoriteEditorSource.match(spring)?.[1]?.replace(/\s/g, '');
  const watchlistSpring = watchlistScreenSource.match(spring)?.[1]?.replace(/\s/g, '');
  assert.ok(favoriteSpring, `favorites must animate ${animation}`);
  assert.equal(favoriteSpring, watchlistSpring, `favorites must use the same ${animation} spring as watchlists`);
}
assert.match(favoriteEditorSource, /resolveCarriedPosterTilt\(horizontalVelocity\)/);
assert.match(favoriteEditorSource, /transformOrigin: \[moving\.gripX, moving\.gripY, 0\]/,
  'the favorite must swing around the point held by the user');
assert.deepEqual(orderedFavorites.map((item) => item.key), ['movie:1', 'series:1', 'movie:2', 'movie:3'], 'sorting must preserve cached source items');
const mergedFavorites = mergeLibraryItems([
  { id: 'movie', contentType: 'movie', tmdbId: 1, favorite: true, favoritePosition: 1, status: 'watched', updatedAt: '2026-01-01' },
  { id: 'series', contentType: 'series', tmdbId: 1, favorite: true, favoritePosition: 0, status: 'watched', updatedAt: '2026-01-01' },
], [], [], []).map((item) => media(item.key, item));
assert.deepEqual(getProfileMediaPreviews(mergedFavorites).favorites.map((item) => item.key), ['series:1', 'movie:1'],
  'owner and public profile library hydration must retain API favorite positions');
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

const plannedItems = [
  media('movie:40', { status: 'watchlisted', updatedAt: '2026-09-14T00:00:00.000Z' }),
  media('series:41', { status: 'watchlisted', updatedAt: '2026-09-16T00:00:00.000Z' }),
  media('movie:42', { status: 'watched' }),
  media('series:43', { status: 'watching' }),
];
assert.deepEqual(getProfileMediaItems(plannedItems, 'planned').map((item) => item.key), [
  'series:41', 'movie:40',
], 'Planned must mix movies and series by recency and exclude watched or in-progress titles');
assert.deepEqual(getProfileMediaPreviews(plannedItems).planned.map((item) => item.key), [
  'series:41', 'movie:40',
]);
assert.equal(getProfileMediaPreviews(recent).planned.length, 0,
  'favorites and alerts alone must not add titles to the Planned list');
assert.equal(getProfileMediaPreviews(recent.map((item) => ({ ...item, status: 'watchlisted' as const }))).planned.length, 10);

const plannedMovie = media('movie:50', {
  status: 'watchlisted', favorite: true, hasReleaseAlert: true,
});
assert.equal(getProfileMediaItems([plannedMovie], 'planned').length, 1);
assert.equal(getProfileMediaItems([{ ...plannedMovie, status: null }], 'planned').length, 0,
  'removing from Planned must work while preserving favorites and alerts');
const watchedMovie = { ...plannedMovie, status: 'watched' as const };
assert.equal(getProfileMediaItems([watchedMovie], 'planned').length, 0,
  'marking a planned movie watched must remove it even if it remains a favorite or has an alert');
assert.deepEqual(groupProfileMediaByStatus([watchedMovie]).completed, [watchedMovie]);

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
for (const title of ['Series', 'Movies', 'Favorites', 'Planned']) {
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
  mediaRailSource.includes('<FlatList')
    && mediaRailSource.includes('initialNumToRender={4}')
    && mediaRailSource.includes('windowSize={3}'),
  'profile media rails must hydrate a small visible window instead of mounting every title',
);
assert(
  mediaRailSource.includes('getProfileMediaDisplayTitle(hydratedItem)'),
  'profile cards must hide unresolved TMDB identifiers while metadata loads',
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
  profileSource.includes('profileBackdropUrl: atmosphereUrl'),
  'owner Profile media pages must preserve their resolved atmosphere',
);
assert.doesNotMatch(
  profileSource,
  /mediaResource\.revalidate\(\)/,
  'returning to Profile must not force another complete Library hydration',
);
assert.doesNotMatch(
  mediaScreenSource,
  /useFocusEffect|useHydratedProfileMediaItems/,
  'Profile media pages must not revalidate or hydrate their complete collection on focus',
);
assert(
  mediaScreenSource.includes("route.params.filter !== 'movies'"),
  'movie pages must hide the In progress section',
);
for (const title of ['In progress', 'Planned', 'Completed']) {
  assert(
    mediaScreenSource.includes(`label: '${title}'`),
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
  mediaScreenSource.includes('paddingTop: headerHeight + spacing.md') && !mediaScreenSource.includes('<ScreenHeader'),
  'Profile media pages must let their blurred background continue behind the transparent native header',
);
assert(
  allTimeRouteSource.includes('headerTransparent: true') && !allTimeRouteSource.includes('headerShown: false'),
  'All Time must preserve its transparent native header',
);

console.log('Profile media model QA passed.');
