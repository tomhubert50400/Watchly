// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { mediaHeroFadeColors, mediaHeroGradientStops } from './mediaHeroGradient';

assert.equal(mediaHeroFadeColors.length, 24, 'The backdrop fade needs enough steps to avoid a hard band.');
assert.equal(mediaHeroFadeColors[0], 'rgba(9, 12, 19, 0)', 'The backdrop fade must begin transparent.');
assert.equal(mediaHeroFadeColors.at(-1), 'rgba(9, 12, 19, 1)', 'The backdrop fade must end on the page background.');
assert.equal(new Set(mediaHeroFadeColors).size, 24, 'Every fade band must progress instead of repeating a solid block.');
assert.deepEqual(
  mediaHeroGradientStops,
  [
    { offset: '0', opacity: 0 },
    { offset: '0.46', opacity: 0.12 },
    { offset: '0.78', opacity: 0.72 },
    { offset: '0.94', opacity: 1 },
    { offset: '1', opacity: 1 },
  ],
  'The vector fade must progress smoothly into the exact page background.',
);

console.log('Media hero gradient QA passed.');
