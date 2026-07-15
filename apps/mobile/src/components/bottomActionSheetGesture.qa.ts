// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import {
  getBottomSheetDragOffset,
  shouldDismissBottomSheet,
} from './bottomActionSheetGesture';

assert.equal(getBottomSheetDragOffset(64), 64, 'downward drag must follow the finger');
assert.equal(getBottomSheetDragOffset(-50), -8, 'upward drag must keep gentle resistance');
assert.equal(shouldDismissBottomSheet(96, 0), true, 'a long downward drag must dismiss');
assert.equal(shouldDismissBottomSheet(24, 1), true, 'a quick downward flick must dismiss');
assert.equal(shouldDismissBottomSheet(72, 0.4), false, 'a short slow drag must snap back');

console.log('Bottom action sheet gesture QA passed.');
