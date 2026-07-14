// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { mediaHeroFadeColors } from './mediaHeroGradient';

assert.equal(mediaHeroFadeColors.length, 24, 'The backdrop fade needs enough steps to avoid a hard band.');
assert.equal(mediaHeroFadeColors[0], 'rgba(9, 12, 19, 0)', 'The backdrop fade must begin transparent.');
assert.equal(mediaHeroFadeColors.at(-1), 'rgba(9, 12, 19, 1)', 'The backdrop fade must end on the page background.');
assert.equal(new Set(mediaHeroFadeColors).size, 24, 'Every fade band must progress instead of repeating a solid block.');

console.log('Media hero gradient QA passed.');
