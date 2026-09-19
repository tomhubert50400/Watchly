// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import {
  resolveDetailMetadataLayout,
  resolveDynamicTypeLayout,
  resolveTrackingStatusLayout,
} from './dynamicTypeLayout';

assert.deepEqual(resolveDynamicTypeLayout(1), {
  headerStacked: false,
  headerTitleMaxFontSizeMultiplier: undefined,
  segmentMinHeight: 44,
  segmentNumberOfLines: 1,
  segmentStacked: false,
});
assert.deepEqual(resolveDynamicTypeLayout(2), {
  headerStacked: true,
  headerTitleMaxFontSizeMultiplier: undefined,
  segmentMinHeight: 64,
  segmentNumberOfLines: 2,
  segmentStacked: false,
});
assert.deepEqual(resolveDynamicTypeLayout(3.2), {
  headerStacked: true,
  headerTitleMaxFontSizeMultiplier: 2,
  segmentMinHeight: 76,
  segmentNumberOfLines: 2,
  segmentStacked: true,
});
assert.deepEqual(resolveTrackingStatusLayout(1), {
  iconVisible: true,
  maxFontSizeMultiplier: undefined,
  numberOfLines: 1,
});
assert.deepEqual(resolveTrackingStatusLayout(3.2), {
  iconVisible: false,
  maxFontSizeMultiplier: 2,
  numberOfLines: 2,
});
assert.deepEqual(resolveDetailMetadataLayout(1), { genreNumberOfLines: 1 });
assert.deepEqual(resolveDetailMetadataLayout(3.2), { genreNumberOfLines: 2 });

const expandableReviewTextSource = readFileSync(
  new URL('./ExpandableReviewText.tsx', import.meta.url),
  'utf8',
);

assert.match(
  expandableReviewTextSource,
  /onTextLayout=\{handleTextLayout\}[\s\S]*numberOfLines=\{isExpanded \? undefined : collapsedLineCount\}/,
  'Expandable reviews must measure the unclamped text separately from the visible five-line text.',
);
assert.match(expandableReviewTextSource, /'Show less' : 'Read more'/);

console.log('Dynamic Type layout QA passed.');
