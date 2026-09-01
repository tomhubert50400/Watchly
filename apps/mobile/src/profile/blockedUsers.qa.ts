import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function read(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

const api = read('../api/blocks.ts');
const app = read('../../App.tsx');
const blockedUsers = read('./BlockedUsersScreen.tsx');
const settings = read('./SettingsScreen.tsx');
const navigationTypes = read('../navigation/types.ts');

assert.match(api, /listBlockedUsers[\s\S]*query\?: string[\s\S]*query=\$\{encodeURIComponent\(query\.trim\(\)\)\}/);
assert.match(navigationTypes, /BlockedUsers: undefined/);
assert.match(app, /component=\{BlockedUsersScreen\}[\s\S]*name="BlockedUsers"[\s\S]*title: 'Blocked users'/);
assert.match(settings, /title="Privacy"[\s\S]*label="Blocked users"[\s\S]*navigation\.navigate\('BlockedUsers'\)/);

assert.match(blockedUsers, /status === 'loading'[\s\S]*<LoadingState label="Loading blocked users"/);
assert.match(blockedUsers, /status === 'error'[\s\S]*title="Blocked users unavailable"[\s\S]*label="Try again"/);
assert.match(blockedUsers, /items\.length === 0[\s\S]*title=\{searchQuery \? 'No blocked users found' : 'No blocked users'\}/);
assert.match(blockedUsers, /setTimeout\(\(\) => setSearchQuery\(query\.trim\(\)\), 250\)/);
assert.match(blockedUsers, /accessibilityLabel="Search blocked users"[\s\S]*clearButtonMode="while-editing"[\s\S]*label="Search blocked users"[\s\S]*maxLength=\{80\}[\s\S]*placeholder="Name or @handle"/);
assert.match(blockedUsers, /listBlockedUsers\(firebaseIdToken, undefined, searchQuery\)/);
assert.match(blockedUsers, /listBlockedUsers\(firebaseIdToken, nextCursor, searchQuery\)/);
assert.match(blockedUsers, /title=\{searchQuery \? 'No blocked users found'[\s\S]*label="Clear search"/);
assert.match(blockedUsers, /items\.map\(\(item, index\)[\s\S]*<UserAvatar[\s\S]*@\{item\.handle\}/);
assert.match(blockedUsers, /nextCursor[\s\S]*label="Load more"[\s\S]*loadNextPage/);
assert.match(blockedUsers, /paginationStatus === 'loading'[\s\S]*Loading more/);
assert.match(blockedUsers, /paginationStatus === 'error'[\s\S]*Could not load more blocked users[\s\S]*Retry/);
assert.match(blockedUsers, /Alert\.alert\([\s\S]*Unblock \$\{item\.displayName\}\?[\s\S]*style: 'destructive'[\s\S]*unblockUser/);
assert.match(blockedUsers, /accessibilityLabel=\{`Unblock \$\{item\.displayName\}`\}[\s\S]*accessibilityRole="button"/);

console.log('Blocked users mobile QA passed.');
