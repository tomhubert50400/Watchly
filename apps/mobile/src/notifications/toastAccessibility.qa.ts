// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { getToastAccessibility } from './toastAccessibility';

const first = getToastAccessibility({ id: 10, message: 'Could not save.' });
const repeated = getToastAccessibility({ id: 11, message: 'Could not save.' });

assert.equal(first.accessibilityRole, 'alert');
assert.equal(first.accessibilityLiveRegion, 'assertive');
assert.equal(first.announcement, 'Could not save.');
assert.notEqual(
  first.announcementKey,
  repeated.announcementKey,
  'repeated feedback must retain a distinct announcement trigger',
);

console.log('Toast accessibility QA passed.');
