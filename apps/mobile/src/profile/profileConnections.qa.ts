import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function read(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

const api = read('../api/profile.ts');
const app = read('../../App.tsx');
const body = read('./ProfileBody.tsx');
const connections = read('./ProfileConnectionsScreen.tsx');
const ownerProfile = read('./ProfileScreen.tsx');
const publicProfile = read('./PublicProfileScreen.tsx');
const summary = read('./ProfileSummaryCard.tsx');

assert.match(api, /getProfileConnections[\s\S]*\/profile\/users\/\$\{encodeURIComponent\(userId\)\}\/\$\{kind\}/);
assert.match(summary, /accessibilityRole="button"[\s\S]*hitSlop=\{10\}[\s\S]*onPress=\{onPress\}/);
assert.match(body, /onFollowersPress=\{onFollowersPress\}[\s\S]*onFollowingPress=\{onFollowingPress\}/);
assert.match(ownerProfile, /onFollowersPress[\s\S]*kind: 'followers'[\s\S]*onFollowingPress[\s\S]*kind: 'following'/);
assert.match(publicProfile, /onFollowersPress[\s\S]*kind: 'followers'[\s\S]*onFollowingPress[\s\S]*kind: 'following'/);
assert.match(connections, /navigation\.push\('PublicProfile',[\s\S]*profilePreview:[\s\S]*userId: item\.id/);
assert.match(connections, /accessibilityHint="Opens this Watchly profile\."[\s\S]*accessibilityRole="button"/);
assert.match(app, /component=\{ProfileConnectionsScreen\}[\s\S]*name="ProfileConnections"/);
assert.match(app, /component=\{PublicProfileScreen\}[\s\S]*name="PublicProfile"[\s\S]*headerShown: false/);

console.log('Profile connections QA passed.');
