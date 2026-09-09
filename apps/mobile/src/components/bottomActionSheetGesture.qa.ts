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
const scrollableSheetFiles = [
  '../auth/SignInRequired.tsx',
  '../opinions/OpinionSheet.tsx',
  '../watchlists/AddToWatchlistControl.tsx',
  '../watchlists/SharedWatchlistScreen.tsx',
];

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
  /<Animated\.View\s+\{\.\.\.\(dragFromHandleOnly \? \{\} : panResponder\.panHandlers\)\}/,
  'the body must yield gestures when dragging is restricted to the header',
);
assert.match(
  sheetSource,
  /<View \{\.\.\.\(dragFromHandleOnly \? panResponder\.panHandlers : \{\}\)\}>/,
  'the header must retain dismissal when body gestures are reserved for controls',
);
assert.match(
  sheetSource,
  /export function BottomActionSheetScrollView/,
  'scrollable sheet content must use one shared gesture-compatible component',
);
assert.match(
  sheetSource,
  /bounces=\{false\}[\s\S]*disableScrollViewPanResponder/,
  'sheet scroll views must yield downward drags to the sheet',
);
assert.match(
  sheetSource,
  /onResponderTerminationRequest=\{\(\) => true\}[\s\S]*onStartShouldSetResponder=\{\(\) => disableScrollViewPanResponder\}/,
  'native scrolling must be able to opt out of the passive gesture surface',
);
assert.match(sheetSource, /dragFromHandleOnly = false/, 'other sheets retain full-surface dragging by default');
const historySource = readFileSync(new URL('../viewings/ViewingHistorySheet.tsx', import.meta.url), 'utf8');
assert.match(historySource, /<BottomActionSheet dragFromHandleOnly/, 'the year wheel must not drag the sheet');
assert.match(historySource, /scrollEnabled=\{!monthPickerOpen\}/, 'the outer content must not scroll while the wheel is open');

for (const file of scrollableSheetFiles) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  assert.match(
    source,
    /<BottomActionSheetScrollView\b/,
    `${file} must use the shared swipe-down scroll surface`,
  );
  assert.doesNotMatch(
    source,
    /<ScrollView\b/,
    `${file} must not bypass the shared swipe-down scroll surface`,
  );
}

console.log('Bottom action sheet gesture QA passed.');
