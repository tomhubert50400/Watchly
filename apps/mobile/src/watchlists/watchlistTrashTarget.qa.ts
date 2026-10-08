import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { draggedPosterCenter, isInsideTrash } from './watchlistTrashTarget';

const target = { x: 16, y: 62, width: 358, height: 76 };
assert(isInsideTrash({ x: 190, y: 82 }, target));
for (const point of [{ x: 15, y: 82 }, { x: 375, y: 82 }, { x: 190, y: 61 }, { x: 190, y: 139 }]) {
  assert(!isInsideTrash(point, target), 'dropping outside the measured header cannot delete');
}
assert(!isInsideTrash({ x: 190, y: 82 }, null), 'an unmeasured header cannot delete');
assert(!isInsideTrash({ x: 16, y: 62 }, { ...target, height: 0 }));
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
const personal = read('./PersonalWatchlistScreen.tsx');
const shared = read('./SharedWatchlistScreen.tsx');
const header = read('./WatchlistTrashHeader.tsx');
assert.doesNotMatch(read('./WatchlistDetailLayout.tsx'), /WatchlistItemMenu|PosterActionsMenu/);
assert.doesNotMatch(personal, /reorderScope|Move titles/);
for (const screen of [personal, shared]) {
  assert.match(screen, /trashHeader=\{trash.header\?\.\(\)\}/);
  assert.match(screen, /const droppedInTrash = trash.isOverTrash/);
  assert.match(screen, /if \(droppedInTrash\).*removal.removeDroppedItem\(item\)/);
}
assert.match(header, /view\?\.measure\(/);
assert.doesNotMatch(header, /useHeaderHeight/, 'The trash target must not depend on a native navigation bar');
assert.match(header, /header: dragging \? header : undefined/);
assert.match(personal, /function cancelMove[\s\S]*?trash.reset\(\)/);
assert.match(shared, /function cancelDrag[\s\S]*?trash.reset\(\)/);

function mountDropHandlers(source: string, endName: string, cancelName: string) {
  const ast = ts.createSourceFile('screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const functions: string[] = [];
  const collect = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && [endName, cancelName].includes(node.name?.text ?? '')) functions.push(node.getText(ast));
    ts.forEachChild(node, collect);
  };
  collect(ast);
  let removed = 0;
  let moved = 0;
  let reset = 0;
  const movingRef = { current: { item: { id: 'title' }, gripX: 50, gripY: 75, width: 100 } as object | null };
  const handlers = runInNewContext(ts.transpileModule(functions.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
    + `\n({ end: ${endName}, cancel: ${cancelName} });`, {
    movingRef, draggedPosterCenter,
    trash: { isOverTrash: (point: { x: number; y: number }) => isInsideTrash(point, target), reset: () => { reset += 1; } },
    removal: { removeDroppedItem: () => { removed += 1; } },
    findMoveTarget: (point: { y: number }) => point.y > 200 ? 'section' : null,
    resolveDestinationSectionId: (id: string) => id, moveItem: () => { moved += 1; },
    resetDragAnimation: () => {}, stopAutoScroll: () => {}, setMoving: () => {}, setHoveredGroupId: () => {},
    targetRectsRef: { current: new Map() },
  });
  return { handlers, movingRef, counts: () => ({ removed, moved, reset }) };
}
for (const [source, end, cancel] of [[personal, 'endMove', 'cancelMove'], [shared, 'endDrag', 'cancelDrag']]) {
  const drop = mountDropHandlers(source, end, cancel);
  const item = { id: 'title', sectionId: null };
  drop.handlers.end(item, { nativeEvent: { pageX: 190, pageY: 82 } });
  drop.handlers.end(item, { nativeEvent: { pageX: 190, pageY: 82 } });
  assert.deepEqual(drop.counts(), { removed: 1, moved: 0, reset: 1 }, 'one drop removes once and never moves sections');
  assert.equal(drop.movingRef.current, null, 'release restores the normal header');
  const cancelled = mountDropHandlers(source, end, cancel);
  cancelled.handlers.cancel(item);
  cancelled.handlers.end(item, { nativeEvent: { pageX: 190, pageY: 82 } });
  assert.equal(cancelled.counts().removed, 0, 'cancelled drags never delete');
  const outside = mountDropHandlers(source, end, cancel);
  outside.handlers.end(item, { nativeEvent: { pageX: 190, pageY: 300 } });
  assert.equal(outside.counts().removed, 0);
  assert.equal(outside.counts().moved, source === personal ? 1 : 0, 'section moves remain available');
  const offCenterGrip = mountDropHandlers(source, end, cancel);
  offCenterGrip.movingRef.current = { item, gripX: 20, gripY: 140, width: 100 };
  offCenterGrip.handlers.end(item, { nativeEvent: { pageX: 160, pageY: 165 } });
  assert.equal(offCenterGrip.counts().removed, 1, 'poster center inside the target deletes even when the finger is below it');
  const fingerOnly = mountDropHandlers(source, end, cancel);
  fingerOnly.movingRef.current = { item, gripX: 50, gripY: 0, width: 100 };
  fingerOnly.handlers.end(item, { nativeEvent: { pageX: 190, pageY: 82 } });
  assert.equal(fingerOnly.counts().removed, 0, 'finger inside the target does not delete a poster centered outside it');
}

const module = { exports: {} as { useWatchlistTrashHeader: (dragging: boolean) => any } };
runInNewContext(ts.transpileModule(header, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, {
  exports: module.exports,
  require: (name: string) => {
    if (name === 'react') return { useRef: (current: unknown) => ({ current }), useCallback: (fn: unknown) => fn, useState: (value: unknown) => [value, () => {}] };
    if (name === 'react/jsx-runtime') return { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) };
    if (name === 'react-native') return { View: 'View', StyleSheet: { create: (value: unknown) => value, absoluteFill: {} } };
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 58 }) };
    if (name === '../design/tokens') return { colors: {}, radii: { xl: 22 }, spacing: { md: 16 } };
    if (name === '../feedback/haptics') return { hapticSelection: () => {} };
    if (name === './watchlistTrashTarget') return { isInsideTrash };
    return {};
  },
});
const trash = module.exports.useWatchlistTrashHeader(true);
const rendered = trash.header();
const capsule = rendered.props.children;
let measuredY = 62;
capsule.props.ref.current = { measure: (callback: (...args: number[]) => void) => callback(0, 0, 358, 76, 16, measuredY) };
capsule.props.onLayout();
assert.equal(rendered.props.style.height, 142, 'the fixed trash overlay must cover its safe-area offset and target without a native header');
assert.equal(capsule.props.style[0].height, 76);
assert(trash.isOverTrash({ x: 190, y: 100 }));
measuredY = 120;
trash.update({ x: 190, y: 150 });
assert(trash.isOverTrash({ x: 190, y: 150 }), 'movement refreshes native bounds after header repositioning');
assert(!trash.isOverTrash({ x: 190, y: 100 }), 'old header coordinates no longer activate');
let finishMeasure: (() => void) | undefined;
capsule.props.ref.current.measure = (callback: (...args: number[]) => void) => { finishMeasure = () => callback(0, 0, 358, 76, 16, 120); };
trash.update({ x: 190, y: 150 });
trash.reset();
finishMeasure?.();
assert(!trash.isOverTrash({ x: 190, y: 150 }), 'a late native measurement cannot reactivate a cancelled target');
console.log('Watchlist trash drop QA passed: measured bounds, outside drop, cancellation, header restoration and direct section drag.');
