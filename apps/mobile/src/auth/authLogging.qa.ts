// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./ProfileAuthCard.tsx', import.meta.url), 'utf8');
const safeErrorSource = source.slice(source.indexOf('function safeError'), source.indexOf('function isFirebaseAuthError'));

assert.doesNotMatch(safeErrorSource, /\.message|String\(error\)/);
assert.match(safeErrorSource, /error\.code/);
assert.match(safeErrorSource, /error\.name/);
assert.match(source, /console\.warn\('Microsoft sign-in failed', safeError\(error\)\)/);

console.log('Auth logging QA passed.');
