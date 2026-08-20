// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

const configSource = readFileSync(new URL('../../app.config.js', import.meta.url), 'utf8');
const firebaseSource = readFileSync(new URL('./firebase.ts', import.meta.url), 'utf8');
const microsoftSource = readFileSync(new URL('./microsoftAuth.ts', import.meta.url), 'utf8');

assert.match(configSource, /msauth\.\$\{applicationId\}/);
assert.match(microsoftSource, /ResponseType\.Code/);
assert.match(microsoftSource, /usePKCE: true/);
assert.match(microsoftSource, /exchangeCodeAsync/);
assert.doesNotMatch(microsoftSource, /client_secret|clientSecret/);
assert.match(firebaseSource, /new OAuthProvider\('microsoft\.com'\)/);
assert.match(firebaseSource, /linkWithMicrosoftTokens/);

console.log('Microsoft auth QA passed.');
