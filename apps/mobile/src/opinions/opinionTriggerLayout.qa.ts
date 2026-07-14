// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { resolveOpinionTriggerLayout } from './opinionTriggerLayout';

assert.deepEqual(resolveOpinionTriggerLayout(false, 1), {
  actionMaxWidth: 148,
  actionsStacked: false,
  contentStacked: false,
});
assert.deepEqual(resolveOpinionTriggerLayout(true, 1), {
  actionMaxWidth: 148,
  actionsStacked: false,
  contentStacked: true,
});
assert.deepEqual(resolveOpinionTriggerLayout(false, 3.2), {
  actionMaxWidth: 148,
  actionsStacked: true,
  contentStacked: true,
});

console.log('Opinion trigger layout QA passed.');
