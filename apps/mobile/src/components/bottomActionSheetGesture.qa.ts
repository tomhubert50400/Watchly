// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readdirSync } from 'node:fs';
import ts from 'typescript';
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
  /const sheetGestureSurfaceHandlers = \{\s*onStartShouldSetResponder: \(\) => true,\s*onResponderTerminationRequest: \(\) => true,/,
  'unclaimed touches must stay below the native Modal responder and yield when the sheet or scroll view claims them',
);
assert.match(
  sheetSource,
  /<View\s+\{\.\.\.sheetGestureSurfaceHandlers\}\s+onStartShouldSetResponder=\{\(\) => disableScrollViewPanResponder \|\| gestureScrollOffset !== null\}/,
  'the passive body responder must live inside the scroll view, including when native scrolling is enabled',
);
assert.match(
  sheetSource,
  /<View \{\.\.\.\(dragFromHandleOnly \? \{\} : sheetGestureSurfaceHandlers\)\} style=\{\[styles.keyboardFrame/,
  'blank sheet space must keep touches below the sheet pan responder without claiming the year wheel',
);
assert.match(sheetSource, /<View \{\.\.\.sheetGestureSurfaceHandlers\} style=\{styles.handle\}/, 'the handle must retain initial touches even in handle-only mode');
assert.match(sheetSource, /<View \{\.\.\.sheetGestureSurfaceHandlers\} style=\{styles.header\}/, 'the title must retain initial touches while letting the close button receive presses first');
assert.match(sheetSource, /SheetScrollGestureContext.Provider value=\{dragFromHandleOnly \? null : gestureScrollOffset\}/, 'the year wheel must remain outside body drag arbitration');
assert.match(sheetSource, /dragFromHandleOnly = false/, 'other sheets retain full-surface dragging by default');
const historySource = readFileSync(new URL('../viewings/ViewingHistorySheet.tsx', import.meta.url), 'utf8');
assert.match(historySource, /<BottomActionSheet dragFromHandleOnly=\{monthPickerOpen\}/, 'the year wheel must not drag the sheet');
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

assert.equal(shouldCaptureBottomSheetDrag(2, 120, 80), false, 'dragging a scrolled list must scroll instead of dismissing');
assert.equal(shouldCaptureBottomSheetDrag(2, 120, 0), true, 'dragging from the top must dismiss');
assert.equal(shouldCaptureBottomSheetDrag(2, 120, -5), true, 'overscroll at the top must allow dismissal');

assert.match(sheetSource, /gestureScrollOffset.current = scrollOffset.current/, 'remember the scroll position at touch start');
assert.match(sheetSource, /shouldCaptureBottomSheetDrag\(gesture.dx, gesture.dy, gestureScrollOffset.current\)/, 'the sheet must respect the initial scroll position');

let sheetCount = 0;
function checkSheets(directory: URL) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) {
      checkSheets(file);
    } else if (entry.name.endsWith('.tsx')) {
      const source = ts.createSourceFile(entry.name, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node: ts.Node) {
        if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === 'BottomActionSheet') {
          sheetCount += 1;
          const restriction = node.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'dragFromHandleOnly');
          if (restriction) {
            assert.equal(entry.name, 'ViewingHistorySheet.tsx', `${file.pathname} must support body swipe dismissal`);
            assert.equal(restriction.getText(source), 'dragFromHandleOnly={monthPickerOpen}', 'only the open year wheel may reserve body gestures');
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
}
checkSheets(new URL('../', import.meta.url));
assert.ok(sheetCount > 0, 'the sheet inventory must not be empty');
console.log(`Bottom action sheet gesture QA passed (${sheetCount} sheets checked).`);
