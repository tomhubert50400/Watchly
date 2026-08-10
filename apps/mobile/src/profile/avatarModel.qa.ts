// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import {
  assertProfileAvatarSize,
  PROFILE_AVATAR_EDGE_PX,
  PROFILE_AVATAR_MAX_BYTES,
} from './avatarModel';

assert.equal(PROFILE_AVATAR_EDGE_PX, 512);
assert.doesNotThrow(() => assertProfileAvatarSize(PROFILE_AVATAR_MAX_BYTES));
assert.throws(() => assertProfileAvatarSize(PROFILE_AVATAR_MAX_BYTES + 1), /too large/);
assert.throws(() => assertProfileAvatarSize(0), /could not be read/);

const profileSummarySource = readFileSync(
  new URL('./ProfileSummaryCard.tsx', import.meta.url),
  'utf8',
);
const profileScreenSource = readFileSync(new URL('./ProfileScreen.tsx', import.meta.url), 'utf8');

assert(
  profileSummarySource.includes('borderWidth: 0') &&
    profileSummarySource.includes('backgroundColor: colors.background') &&
    profileSummarySource.includes("accessibilityLabel={avatarUrl ? 'Change profile photo' : 'Add profile photo'}"),
  'The profile avatar must be borderless, use a background-colored edit notch, and expose an accessible direct edit action.',
);
assert(
  profileScreenSource.includes('onAvatarPress={profile.avatarUploadsEnabled ? openAvatarActions : undefined}') &&
    profileScreenSource.includes('chooseAndUploadProfileAvatar(firebaseIdToken)'),
  'The owner profile must allow changing the avatar without opening settings.',
);

console.log('Profile avatar model QA passed.');
