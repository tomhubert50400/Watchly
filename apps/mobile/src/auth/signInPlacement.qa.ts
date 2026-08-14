// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

const signInSheetSource = readFileSync(new URL('./SignInRequired.tsx', import.meta.url), 'utf8');
const authSessionSource = readFileSync(new URL('./AuthSessionContext.tsx', import.meta.url), 'utf8');
const profileAuthCardSource = readFileSync(new URL('./ProfileAuthCard.tsx', import.meta.url), 'utf8');

assert.match(
  authSessionSource,
  /error instanceof ApiError && error\.status === 403 \? error\.message/,
  'a restored suspended session must retain the safe API access message',
);
assert.match(
  profileAuthCardSource,
  /error instanceof ApiError && error\.status === 403\) return error\.message/,
  'sign-in must show the safe suspension message instead of a generic 403 error',
);

assert.match(
  signInSheetSource,
  /<BottomActionSheetScrollView\b/,
  'the sign-in sheet must use the shared swipe-down scroll surface',
);
assert.match(
  signInSheetSource,
  /sheetContent:\s*\{\s*flexGrow: 1/,
  'the sign-in gesture surface must cover empty sheet space',
);

const protectedScreens = [
  '../feed/FeedScreen.tsx',
  '../journal/JournalScreen.tsx',
  '../library/LibraryScreen.tsx',
  '../notifications/NotificationsScreen.tsx',
  '../notifications/ReleaseCalendarScreen.tsx',
  '../profile/PublicProfileScreen.tsx',
  '../profile/SettingsScreen.tsx',
  '../watchlists/PersonalWatchlistScreen.tsx',
  '../watchlists/SharedVoteScreen.tsx',
  '../watchlists/SharedWatchlistScreen.tsx',
];

for (const file of protectedScreens) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  assert.match(
    source,
    /<SignInRequiredCard\b/,
    `${file} must offer sign-in inside its signed-out state`,
  );
}

for (const file of [
  '../notifications/ReleaseAlertControl.tsx',
  '../opinions/OpinionSheet.tsx',
  '../watchlists/AddToWatchlistControl.tsx',
]) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  assert.match(
    source,
    /<SignInSheet\b/,
    `${file} must open sign-in without sending the user to Profile`,
  );
}

for (const file of [
  '../home/HomeScreen.tsx',
  '../tracking/ComputedRatingSummary.tsx',
  '../tracking/SeriesProgressSummary.tsx',
]) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  assert.match(
    source,
    /<SignInRequiredCard\b/,
    `${file} must provide contextual sign-in for its private features`,
  );
}

for (const file of [
  ...protectedScreens,
  '../episodes/SeasonEpisodeList.tsx',
  '../home/HomeScreen.tsx',
  '../tracking/ComputedRatingSummary.tsx',
  '../tracking/EpisodeRatingControl.tsx',
  '../tracking/MovieRatingControl.tsx',
  '../tracking/SeasonProgressSummary.tsx',
  '../tracking/SeriesProgressSummary.tsx',
]) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  assert.doesNotMatch(
    source,
    /Sign in from Profile/i,
    `${file} must not send signed-out users elsewhere to authenticate`,
  );
}

console.log('Sign-in placement QA passed.');
