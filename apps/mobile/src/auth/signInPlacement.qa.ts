// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

const signInSheetSource = readFileSync(new URL('./SignInRequired.tsx', import.meta.url), 'utf8');

assert.match(
  signInSheetSource,
  /<ScrollView\s+bounces=\{false\}[\s\S]*?disableScrollViewPanResponder/,
  'the sign-in sheet scroll view must yield downward drags to the sheet',
);
assert.match(
  signInSheetSource,
  /<View\s+onResponderTerminationRequest=\{\(\) => true\}\s+onStartShouldSetResponder=\{\(\) => true\}\s+style=\{styles\.sheetGestureSurface\}/,
  'passive sign-in content must start a responder so the whole sheet can capture its drag',
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
