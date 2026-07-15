// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import {
  getBottomSheetDragOffset,
  shouldCaptureBottomSheetDrag,
  shouldDismissBottomSheet,
} from './bottomActionSheetGesture';

const sheetSource = readFileSync(new URL('./BottomActionSheet.tsx', import.meta.url), 'utf8');

assert.equal(getBottomSheetDragOffset(64), 64, 'downward drag must follow the finger');
assert.equal(getBottomSheetDragOffset(-50), -8, 'upward drag must keep gentle resistance');
assert.equal(shouldCaptureBottomSheetDrag(2, 12), true, 'a downward gesture must move the whole sheet');
assert.equal(shouldCaptureBottomSheetDrag(12, 8), false, 'a horizontal gesture must remain available to content');
assert.equal(shouldCaptureBottomSheetDrag(2, -12), false, 'an upward gesture must remain available to content');
assert.equal(shouldDismissBottomSheet(96, 0), true, 'a long downward drag must dismiss');
assert.equal(shouldDismissBottomSheet(24, 1), true, 'a quick downward flick must dismiss');
assert.equal(shouldDismissBottomSheet(72, 0.4), false, 'a short slow drag must snap back');
assert.match(
  sheetSource,
  /<Animated\.View\s+\{\.\.\.panResponder\.panHandlers\}\s+accessibilityViewIsModal/,
  'the entire sheet must own the drag responder',
);
assert.doesNotMatch(
  sheetSource,
  /<View \{\.\.\.panResponder\.panHandlers\}>/,
  'drag handling must not be limited to the header content',
);

console.log('Bottom action sheet gesture QA passed.');
