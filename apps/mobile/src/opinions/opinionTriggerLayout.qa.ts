// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { resolveOpinionTriggerLayout } from './opinionTriggerLayout';

assert.deepEqual(resolveOpinionTriggerLayout(1), {
  actionsStacked: false,
});
assert.deepEqual(resolveOpinionTriggerLayout(3.2), {
  actionsStacked: true,
});

console.log('Opinion trigger layout QA passed.');
