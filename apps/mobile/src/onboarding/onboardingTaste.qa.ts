import assert from 'node:assert/strict';
import {
  canAddOnboardingTasteItem,
  getOnboardingTasteCount,
  isOnboardingTasteSelectionValid,
  ONBOARDING_TASTE_LIMIT_PER_TYPE,
  ONBOARDING_TASTE_TOTAL_LIMIT,
} from './onboardingTaste';
import { OnboardingTasteItem } from './onboardingDraft';

const movie = (tmdbId: number): OnboardingTasteItem => ({
  contentType: 'movie',
  posterUrl: null,
  title: `Movie ${tmdbId}`,
  tmdbId,
});
const series = (tmdbId: number): OnboardingTasteItem => ({
  contentType: 'series',
  posterUrl: null,
  title: `Series ${tmdbId}`,
  tmdbId,
});

assert.equal(ONBOARDING_TASTE_LIMIT_PER_TYPE, 5);
assert.equal(ONBOARDING_TASTE_TOTAL_LIMIT, 10);
assert.equal(isOnboardingTasteSelectionValid([]), false);
assert.equal(isOnboardingTasteSelectionValid([movie(1)]), true);

const fiveMovies = Array.from({ length: 5 }, (_, index) => movie(index + 1));
assert.equal(getOnboardingTasteCount(fiveMovies, 'movie'), 5);
assert.equal(canAddOnboardingTasteItem(fiveMovies, 'movie'), false);
assert.equal(canAddOnboardingTasteItem(fiveMovies, 'series'), true);

const fiveOfEach = [
  ...fiveMovies,
  ...Array.from({ length: 5 }, (_, index) => series(index + 1)),
];
assert.equal(isOnboardingTasteSelectionValid(fiveOfEach), true);
assert.equal(isOnboardingTasteSelectionValid([...fiveOfEach, movie(99)]), false);
assert.equal(
  isOnboardingTasteSelectionValid(Array.from({ length: 6 }, (_, index) => movie(index + 1))),
  false,
);

console.log('Onboarding taste QA passed.');
