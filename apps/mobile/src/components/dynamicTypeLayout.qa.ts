// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
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

console.log('Dynamic Type layout QA passed.');
