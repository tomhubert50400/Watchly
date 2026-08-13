// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import { resolveTextInputAccessibilityLabel } from './textInputAccessibility';

const textInput = readFileSync(new URL('./TextInput.tsx', import.meta.url), 'utf8');

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
assert.match(
  textInput,
  /error \? <Text accessibilityLiveRegion="polite"/,
  'field errors must be announced when they appear',
);

console.log('Text input accessibility QA passed.');
