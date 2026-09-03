// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const episodeProgress = source('../episodes/useSeasonEpisodes.ts');
const opinion = source('../opinions/OpinionSheet.tsx');
const releaseAlert = source('../notifications/ReleaseAlertControl.tsx');
const reviewPost = source('../components/SocialReviewPost.tsx');
const settings = source('../profile/SettingsScreen.tsx');
const sharedVote = source('../watchlists/SharedVoteScreen.tsx');
const tracking = source('../tracking/TrackingControls.tsx');
const viewingCount = source('../viewings/ViewingCountControl.tsx');
const watchlists = source('../watchlists/AddToWatchlistControl.tsx');

for (const [name, implementation] of [
  ['episode progress', episodeProgress],
  ['opinion rating', opinion],
  ['release alert', releaseAlert],
  ['review like', reviewPost],
  ['shared vote', sharedVote],
  ['tracking state', tracking],
  ['viewing count', viewingCount],
  ['watchlist membership', watchlists],
] as const) {
  assert.match(
    implementation,
    /MutationQueueRef|mutationQueueRef|optionMutationQueuesRef|voteMutationQueueRef/,
    `${name} must serialize rapid backend mutations without blocking local taps`,
  );
}

for (const [name, implementation] of [
  ['episode progress', episodeProgress],
  ['opinion rating', opinion],
  ['release alert', releaseAlert],
  ['shared vote', sharedVote],
  ['tracking state', tracking],
  ['viewing count', viewingCount],
  ['watchlist membership', watchlists],
] as const) {
  assert.match(
    implementation,
    /writePersistedCache/,
    `${name} must preserve its optimistic state in the private local cache`,
  );
}

assert.doesNotMatch(
  episodeProgress,
  /notifyTrackingChanged|isSaving/,
  'episode taps must not use the removed global refresh or visible saving state',
);
assert.doesNotMatch(
  viewingCount,
  /ActivityIndicator|Another watch was logged/,
  'viewing count increments must not expose backend progress or success chrome',
);
assert.doesNotMatch(
  watchlists,
  /buildSelectionDiff|buildSelectionLabel|Save changes/,
  'watchlist membership must auto-save each choice instead of waiting for a save action',
);
assert.doesNotMatch(
  reviewPost,
  /disabled=\{[^}]*pending|hapticSelection/,
  'likes must stay tappable and silent while their backend queue drains',
);
assert.match(
  settings,
  /footer=\{isDirty \? \(/,
  'settings must accept local changes immediately and dismiss the save footer',
);
assert.doesNotMatch(
  settings,
  /footer=\{isDirty \|\| status === 'saving'/,
  'settings backend work must not keep a visible saving footer mounted',
);

console.log('Instant user interactions QA passed.');
