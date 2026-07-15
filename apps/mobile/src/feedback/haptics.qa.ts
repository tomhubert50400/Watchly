// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

const helperSource = readFileSync(new URL('haptics.ts', import.meta.url), 'utf8');

assert.match(helperSource, /export function hapticConfirm\(/, 'routine confirmations need a shared light haptic');
assert.match(helperSource, /ImpactFeedbackStyle\.Light/, 'routine confirmations must stay light');
assert.match(helperSource, /export function hapticSuccess\(/, 'important completions need a shared success haptic');
assert.match(helperSource, /NotificationFeedbackType\.Success/, 'important completions must use success feedback');
assert.match(helperSource, /export function hapticError\(/, 'explicit mutation failures need a shared error haptic');
assert.match(helperSource, /NotificationFeedbackType\.Error/, 'mutation failures must use error feedback');
assert.match(helperSource, /export function hapticSelection\(/, 'selection changes need a shared selection haptic');
assert.match(helperSource, /selectionAsync\(\)/, 'selection changes must use the native selection feedback');
assert.match(helperSource, /\.catch\(\(\) => undefined\)/, 'unavailable haptics must never break the action');

for (const [file, haptic] of [
  ['../auth/ProfileAuthCard.tsx', 'hapticSuccess'],
  ['../components/SegmentedControl.tsx', 'hapticSelection'],
  ['../episodes/useSeasonEpisodes.ts', 'hapticConfirm'],
  ['../library/LibraryScreen.tsx', 'hapticConfirm'],
  ['../notifications/ReleaseAlertControl.tsx', 'hapticConfirm'],
  ['../opinions/OpinionSheet.tsx', 'hapticConfirm'],
  ['../profile/SettingsScreen.tsx', 'hapticSuccess'],
  ['../tracking/TrackingControls.tsx', 'hapticConfirm'],
  ['../watchlists/AddToWatchlistControl.tsx', 'hapticConfirm'],
  ['../watchlists/SharedVoteScreen.tsx', 'hapticConfirm'],
  ['../watchlists/SharedWatchlistScreen.tsx', 'hapticSuccess'],
] as const) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  assert.match(source, new RegExp(`\\b${haptic}\\(\\)`), `${file} must trigger ${haptic} after its confirmed action`);
}

console.log('Haptic feedback QA passed.');
