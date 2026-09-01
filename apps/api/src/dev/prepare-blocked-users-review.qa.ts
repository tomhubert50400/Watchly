import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(__dirname, 'prepare-blocked-users-review.ts'), 'utf8');

assert.match(source, /process\.env\.APP_ENV !== 'staging'/);
assert.match(source, /BLOCKED_FIXTURE_COUNT = 21/);
assert.match(source, /BLOCKED_USERS_REVIEW_USER_ID/);
assert.match(source, /process\.argv\.includes\('--list-users'\)/);
assert.match(source, /process\.argv\.includes\('--cleanup'\)/);
assert.match(source, /displayName: 'Block candidate'[\s\S]*handle: 'block_candidate'/);
assert.match(source, /blockedUserId: fixture\.id,[\s\S]*blockerId: target\.id/);
assert.match(source, /authIdentities:[\s\S]*none:[\s\S]*FIXTURE_IDENTITY_PREFIX/);
assert.doesNotMatch(source, /APP_ENV.*production/);

console.log('Blocked users staging review seed QA passed.');
