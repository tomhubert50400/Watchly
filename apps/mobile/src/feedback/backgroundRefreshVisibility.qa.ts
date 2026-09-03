// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const screens = [
  '../catalogue/EpisodeDetailScreen.tsx',
  '../catalogue/ExploreScreen.tsx',
  '../catalogue/FilmDetailScreen.tsx',
  '../catalogue/SeasonDetailScreen.tsx',
  '../catalogue/SeriesDetailScreen.tsx',
  '../episodes/SeasonEpisodeList.tsx',
  '../home/HomeScreen.tsx',
  '../journal/JournalScreen.tsx',
  '../library/LibraryScreen.tsx',
  '../notifications/NotificationsScreen.tsx',
  '../profile/ProfileScreen.tsx',
  '../watchlists/PersonalWatchlistScreen.tsx',
  '../watchlists/SharedVoteScreen.tsx',
  '../watchlists/SharedWatchlistScreen.tsx',
].map(source);

const visibleBackgroundMessages = [
  'Keeping current content visible while new data arrives.',
  'Personalizing Home',
  'Cached discovery stays visible while Watchly updates it.',
  'Keeping these results visible while search updates.',
  'Your saved profile stays visible.',
  'Keeping saved alerts visible while checking for updates.',
  'Refreshing film details',
  'Refreshing series details',
  'Refreshing episode details',
  'Refreshing season details',
  'Refreshing episodes and progress',
  'Keeping this list visible while fresh data arrives.',
  'Keeping saved titles visible.',
  'Keeping the saved vote visible.',
];

for (const message of visibleBackgroundMessages) {
  for (const screen of screens) {
    assert.doesNotMatch(
      screen,
      new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `background refresh copy must stay hidden: ${message}`,
    );
  }
}

const homeSource = source('../home/HomeScreen.tsx');
assert.match(
  homeSource,
  /section\.error && section\.items\.length === 0/,
  'Home must hide refresh failures when section content is already visible',
);
assert.match(
  homeSource,
  /useFocusEffect\(useCallback\(\(\) => \{\s*if \(isSignedIn\) \{\s*notifications\.revalidate\(\);\s*\}\s*\}, \[isSignedIn, notifications\.revalidate\]\)\);/,
  'Home focus updates must revalidate notifications without driving the native refresh control',
);
assert.doesNotMatch(
  homeSource,
  /useFocusEffect\(useCallback\(\(\) => \{\s*if \(isSignedIn\) \{\s*notifications\.retry\(\);/,
  'Home focus updates must not trigger a visible pull-to-refresh',
);

const cachedResourceSource = source('../cache/useCachedResource.ts');
assert.match(
  cachedResourceSource,
  /revalidate: \(\) => void/,
  'cached resources must expose a silent revalidation path',
);
assert.match(
  cachedResourceSource,
  /isRequestedRefresh = isManualRetry \|\| isSilentRevalidation/,
  'silent revalidation must still bypass fresh-cache short circuits',
);

const authSessionSource = source('../auth/AuthSessionContext.tsx');
const firebaseAuthSource = source('../auth/firebase.ts');
const freshTokenSource = firebaseAuthSource.slice(
  firebaseAuthSource.indexOf('export async function getFreshFirebaseIdToken'),
  firebaseAuthSource.indexOf(
    'export async function getFirebaseSessionFromUser',
    firebaseAuthSource.indexOf('export async function getFreshFirebaseIdToken'),
  ),
);
assert.doesNotMatch(
  freshTokenSource,
  /getIdToken\(true\)/,
  'authenticated reads must not force credential rotation on every request',
);
assert.doesNotMatch(
  authSessionSource,
  /(social|tracking)Revision|notify(Social|Tracking)Changed/,
  'routine user-data refreshes must not invalidate authentication consumers',
);
const userDataEventsSource = source('../sync/userDataEvents.ts');
assert.match(
  userDataEventsSource,
  /useSyncExternalStore/,
  'user-data refresh consumers must subscribe to scoped external-store domains',
);

const exploreSource = source('../catalogue/ExploreScreen.tsx');
assert.match(
  exploreSource,
  /const resultCount = items\.length \+ people\.length;[\s\S]*isLoading && resultCount === 0/,
  'Explore must reserve search loading UI for an empty media and people result area',
);

const progressSource = source('../tracking/EpisodeProgressControl.tsx');
assert.doesNotMatch(
  progressSource,
  /model\.isSaving \|\| model\.isRefreshing/,
  'episode progress must not overlay visible controls during background refresh',
);
assert.doesNotMatch(
  progressSource,
  /model\.isSaving|ActivityIndicator/,
  'episode progress mutations must stay interactive and render no backend spinner',
);

const feedSource = source('../feed/FeedScreen.tsx');
assert.match(
  feedSource,
  /const items = resource\.data \?\? \[\]/,
  'Feed must keep rendering the cached Community items during revalidation',
);
assert.match(
  feedSource,
  /resource\.isInitialLoading && items\.length === 0/,
  'Feed must only replace an empty feed with its loading state',
);
assert.match(
  feedSource,
  /resource\.error && items\.length === 0/,
  'Feed must hide refresh failures when Community items are already visible',
);

const publicProfileSource = source('../profile/PublicProfileScreen.tsx');
assert.match(
  publicProfileSource,
  /const requestToken = firebaseIdTokenRef\.current/,
  'public profile requests must read renewable credentials without using them as screen identity',
);
assert.match(
  publicProfileSource,
  /\}, \[hydrateLoadedProfile, isOwnPreview, isSignedIn, route\.params\.userId\]\);/,
  'public profile loading scope must depend on session and profile identity, not token rotation',
);
assert.match(
  publicProfileSource,
  /status === 'loading' && !profile \? \([\s\S]*<PublicProfileLoadingState/,
  'public profiles must show a profile-shaped skeleton only while no hydrated profile is visible',
);
assert.doesNotMatch(
  publicProfileSource,
  /LoadingState label="Loading profile"/,
  'public profiles must not fall back to a centered spinner while loading',
);

const ownerProfileSource = source('../profile/ProfileScreen.tsx');
assert.match(
  ownerProfileSource,
  /return loadProfileData\(firebaseIdToken, refreshSeries, cached\)/,
  'automatic owner profile revalidation must reuse the current credential without forcing token rotation',
);
assert.doesNotMatch(
  ownerProfileSource,
  /Loading your (favorites|movies|series)/,
  'optional profile media rails must stay hidden until their data is ready',
);
assert.match(
  ownerProfileSource,
  /resource\.isInitialLoading && !profile \? \([\s\S]*<OwnerProfileLoadingState/,
  'the owner profile must show a profile-shaped skeleton while no cached profile is visible',
);
assert.doesNotMatch(
  ownerProfileSource,
  /<LoadingState label="Loading your profile"/,
  'the owner profile must not fall back to a centered spinner while loading',
);
assert.match(
  ownerProfileSource,
  /accessibilityLabel="Loading your profile"[\s\S]*accessibilityRole="progressbar"/,
  'the owner profile skeleton must expose one accessible loading state',
);

const profileBodySource = source('../profile/ProfileBody.tsx');
assert.match(
  profileBodySource,
  /showMediaRails \? \(/,
  'profile media rails must support silent initial loading',
);
assert.doesNotMatch(
  publicProfileSource,
  /Follow state could not load|['"]Loading\.\.\.['"]/,
  'follow relationship state must load without exposing technical status copy',
);

const notificationsSource = source('../notifications/NotificationsScreen.tsx');
assert.match(
  notificationsSource,
  /loadPendingFollowRequests\(true\)[\s\S]*refreshing=\{resource\.isRefreshing \|\| isRefreshingFollowRequests\}/,
  'only manual follow-request refreshes may drive the native refresh control',
);

const onboardingSource = source('../onboarding/OnboardingScreen.tsx');
assert.match(
  onboardingSource,
  /searchLoading && searchItems\.length === 0/,
  'onboarding search must keep existing results visible while the next query loads',
);
assert.doesNotMatch(
  onboardingSource,
  /setSearchLoading\(true\);\s*setSearchError\(null\);\s*setSearchItems\(\[\]\);/,
  'onboarding search must not clear visible results before the next query completes',
);

const streamingSource = source('../catalogue/StreamingAvailabilityPanel.tsx');
assert.doesNotMatch(
  streamingSource,
  /LoadingState|Checking providers|Could not load streaming availability/,
  'optional provider enrichment must load and fail silently',
);

const episodeCommunitySource = source('../catalogue/EpisodeCommunityPanel.tsx');
assert.doesNotMatch(
  episodeCommunitySource,
  /Loading community opinions|Could not load ratings and reviews/,
  'optional episode community data must load and fail silently',
);

const exploreDiscoverySource = source('../catalogue/ExploreDiscoveryScreen.tsx');
assert.doesNotMatch(
  exploreDiscoverySource,
  /Could not refresh these picks/,
  'discovery refresh failures must stay hidden while existing groups remain visible',
);
assert.doesNotMatch(
  episodeCommunitySource,
  /trackingRevision|opinionRevision,\s*\]\s*\.join/,
  'episode community cache identity must remain stable during opinion revalidation',
);

const viewingCountSource = source('../viewings/ViewingCountControl.tsx');
assert.doesNotMatch(
  viewingCountSource,
  /isSaving|ActivityIndicator|Another watch was logged/,
  'viewing mutations must update locally without backend progress or success feedback',
);
assert.match(
  viewingCountSource,
  /writePersistedCache\(cacheKey, optimisticSummary\)/,
  'optimistic viewing counts must be persisted locally',
);

const opinionSource = source('../opinions/OpinionSheet.tsx');
assert.doesNotMatch(
  opinionSource,
  /if \(isLoading\)|Rated \$\{score\}|hapticConfirm/,
  'opinion controls must stay mounted and avoid backend success feedback',
);
assert.match(
  opinionSource,
  /writePersistedCache\(cacheKey, \{[\s\S]*rating: optimistic\.savedRating/,
  'optimistic ratings must be persisted locally before backend confirmation',
);

console.log('Background refresh visibility QA passed.');
