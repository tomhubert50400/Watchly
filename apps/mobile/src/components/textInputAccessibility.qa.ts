// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { resolveTextInputAccessibilityLabel } from './textInputAccessibility';

for (const label of ['New list name', 'Vote title', 'Profile code']) {
  assert.equal(
    resolveTextInputAccessibilityLabel(label, undefined),
    label,
    `${label} must be exposed programmatically when no override is supplied`,
  );
}
assert.equal(
  resolveTextInputAccessibilityLabel('Visible label', 'Specific accessible label'),
  'Specific accessible label',
  'an explicit accessible label must remain supported',
);

console.log('Text input accessibility QA passed.');
