import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function read(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

const profileApi = read('../api/profile.ts');
const profileBody = read('./ProfileBody.tsx');
const publicProfile = read('./PublicProfileScreen.tsx');
const statsSummary = read('./ViewingStatsSummaryCard.tsx');
const blockedBranchStart = publicProfile.indexOf('blockRelationship ? (');
const blockedBranchEnd = publicProfile.indexOf(') : !profile.canViewContent', blockedBranchStart);

assert.ok(blockedBranchStart >= 0 && blockedBranchEnd > blockedBranchStart);
const blockedBranch = publicProfile.slice(blockedBranchStart, blockedBranchEnd);

assert.match(
  profileApi,
  /blockRelationship: 'blocked_by_profile' \| 'blocked_by_viewer' \| null/,
  'the public profile contract must distinguish both sides of a block',
);
assert.match(
  publicProfile,
  /blockRelationship === 'blocked_by_viewer'[\s\S]*label=\{isUpdatingBlock \? 'Updating\.\.\.' : 'Unblock'\}/,
  'a viewer-initiated block must replace Follow with Unblock',
);
assert.match(
  publicProfile,
  /activeProfile\?\.blockRelationship[\s\S]*blockState\?\.blocked \? 'blocked_by_viewer' : null/,
  'a completed block mutation must reveal the blocked state even before profile refresh finishes',
);
assert.match(
  publicProfile,
  /blockRelationship === 'blocked_by_profile'[\s\S]*disabled[\s\S]*label="Follow profile"/,
  'a profile-initiated block must leave Follow visible and disabled',
);
assert.match(
  publicProfile,
  /const blockedProfile = currentProfile[\s\S]*blockRelationship: 'blocked_by_viewer'[\s\S]*setProfile\(blockedProfile\)[\s\S]*getPublicProfile\(firebaseIdToken, route\.params\.userId\)[\s\S]*catch\(\(\) => undefined\)/,
  'a successful block must switch to the local blocked overview before its background refresh',
);
assert.match(publicProfile, /You blocked this member\./);
assert.match(publicProfile, /This member blocked you\./);
assert.match(
  blockedBranch,
  /styles\.blockedProfile[\s\S]*<ProfileSummaryCard[\s\S]*\{followButton\}[\s\S]*styles\.blockedNotice/,
  'blocked profiles must retain identity, the relationship action, and the explanation',
);
assert.doesNotMatch(blockedBranch, /ProfileBody|viewingStats|onOpenStats|statsTitle/);
assert.match(
  publicProfile,
  /background=\{atmosphereUrl \? <SpotlightAtmosphere fadeIn imageUrl=\{atmosphereUrl\} \/> : null\}/,
  'blocked profiles must keep the normal profile atmosphere',
);
assert.match(publicProfile, /statsTitle=\{isOwnPreview \? 'YOUR STATS' : 'STATS'\}/);
assert.match(profileBody, /statsTitle[\s\S]*title=\{statsTitle\}/);
assert.match(statsSummary, /title = 'YOUR STATS'[\s\S]*>\{title\}<\/Text>/);
assert.doesNotMatch(publicProfile, /Blocked profile/);

console.log('Blocked profile presentation QA passed.');
