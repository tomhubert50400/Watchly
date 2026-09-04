import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(__dirname, 'profile.service.ts'), 'utf8');

assert.match(
  source,
  /this\.listOpinionsForUser\(user\.id\)[\s\S]*this\.getPublicProfileMedia\(user\.id\)[\s\S]*getStatsForUser\(user\.id\)/,
  'public profiles must load the same opinion, media, and viewing-stat families as owner profiles',
);
assert.match(
  source,
  /const profileContent = canViewContent[\s\S]*\? await Promise\.all\(\[[\s\S]*this\.listOpinionsForUser\(user\.id\)[\s\S]*this\.getPublicProfileMedia\(user\.id\)[\s\S]*getStatsForUser\(user\.id\)/,
  'independent public profile content families must load in parallel',
);
assert.match(
  source,
  /opinions: opinions\?\.items \?\? \[\][\s\S]*profileBackdrop: canViewContent \|\| isBlockedProfile[\s\S]*viewingStats: viewingStats \?\? null/,
  'public profile responses must include the selected backdrop, opinions, and viewing stats',
);
assert.match(
  source,
  /media: media \?\? \{[\s\S]*movieRatings: \[\][\s\S]*releaseAlerts: \[\][\s\S]*seriesProgress: \[\][\s\S]*trackingStates: \[\]/,
  'hidden profiles must return empty media sources instead of leaking private state',
);
assert.match(
  source,
  /avatarUrl: this\.avatarStorage\.getPublicUrl\(user\.avatarObjectKey\)[\s\S]*displayName: user\.displayName[\s\S]*handle: user\.handle/,
  'private profile projections must retain the public identity header',
);
assert.match(
  source,
  /removeAvatar[\s\S]*providerAvatarImportDisabled: true[\s\S]*providerAvatarImportEnabled: !user\.providerAvatarImportDisabled/,
  'removing an avatar must prevent a later automatic provider-photo import',
);
assert.match(
  source,
  /const socialStats = canViewContent[\s\S]*this\.getProfileSocialStats\(user\.id\)[\s\S]*followersCount: socialStats\?\.followersCount[\s\S]*followingCount: socialStats\?\.followingCount/,
  'private profile projections must retain follower and following counts',
);
assert.match(
  source,
  /const blockRelationship = [\s\S]*getProfileBlockRelationship\(viewerId, userId\)[\s\S]*blockRelationship,/,
  'public profile responses must identify which side initiated a block',
);
assert.match(
  source,
  /profileBackdrop: canViewContent \|\| isBlockedProfile[\s\S]*reviewsCount: canViewContent \|\| isBlockedProfile[\s\S]*viewingStats: viewingStats \?\? null/,
  'blocked profile projections must retain identity counts and backdrop without exposing viewing stats',
);
assert.doesNotMatch(
  source,
  /isBlockedProfile[\s\S]{0,120}getStatsForUser\(user\.id\)/,
  'blocked profiles must not load viewing stats',
);

console.log('Public profile parity QA passed.');
