// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import {
  formatProfileHandle,
  getProfileHandleError,
  normalizeProfileHandleInput,
} from './profileHandle';

assert.equal(normalizeProfileHandleInput(' @Cinema_Fan '), 'cinema_fan');
assert.equal(formatProfileHandle('cinema_fan'), '@cinema_fan');
assert.equal(formatProfileHandle(null), null);
assert.equal(getProfileHandleError('cinema_fan'), null);
assert.match(getProfileHandleError('ab') ?? '', /at least 3/);
assert.match(getProfileHandleError('with space') ?? '', /letters, numbers, and underscores/);
assert.match(getProfileHandleError('a'.repeat(21)) ?? '', /no more than 20/);

const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const onboardingSource = readFileSync(new URL('../onboarding/OnboardingScreen.tsx', import.meta.url), 'utf8');
const profileSummarySource = readFileSync(new URL('./ProfileSummaryCard.tsx', import.meta.url), 'utf8');

assert.match(
  appSource,
  /!currentUser\.onboardingCompleted \|\| !currentUser\.handle/,
  'existing accounts without a handle must enter the one-time claim flow',
);
assert.match(
  onboardingSource,
  /getHandleAvailability\([\s\S]*completeOnboarding\(firebaseIdToken, normalizeProfileHandleInput\(handle\)\)/,
  'onboarding must check availability and submit the permanent handle',
);
assert.match(
  profileSummarySource,
  /formatProfileHandle\(handle\)/,
  'profile headers must show the permanent handle separately from the display name',
);

console.log('Profile handle mobile QA passed.');
