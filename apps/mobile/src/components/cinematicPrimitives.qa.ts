// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import { getBannerPresentation, getStarFillRatios, normalizeRating } from './cinematicPrimitives';

const starRatingSource = readFileSync(new URL('StarRatingDisplay.tsx', import.meta.url), 'utf8');

assert.equal(normalizeRating(-1), 0);
assert.equal(normalizeRating(3.24), 3);
assert.equal(normalizeRating(3.25), 3.5);
assert.equal(normalizeRating(8), 5);
assert.deepEqual(getStarFillRatios(3.5), [1, 1, 1, 0.5, 0]);
assert.deepEqual(getStarFillRatios(0), [0, 0, 0, 0, 0]);
assert.deepEqual(getStarFillRatios(5), [1, 1, 1, 1, 1]);
assert.match(
  starRatingSource,
  /fillClip, \{ height: size, width: size \* fill \}/,
  'pink rating fill must have visible height',
);

assert.deepEqual(getBannerPresentation('updating'), {
  accessibilityRole: 'summary',
  defaultTitle: 'Updating',
  icon: 'refresh',
  showsActivity: true,
});
assert.deepEqual(getBannerPresentation('offline'), {
  accessibilityRole: 'alert',
  defaultTitle: 'You are offline',
  icon: 'offline',
  showsActivity: false,
});
assert.deepEqual(getBannerPresentation('error'), {
  accessibilityRole: 'alert',
  defaultTitle: 'Unable to update',
  icon: 'error',
  showsActivity: false,
});
assert.deepEqual(getBannerPresentation('success'), {
  accessibilityRole: 'summary',
  defaultTitle: 'Up to date',
  icon: 'success',
  showsActivity: false,
});

console.log('Cinematic primitive QA passed.');
