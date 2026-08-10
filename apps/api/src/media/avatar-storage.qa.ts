import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import {
  assertAvatarObjectOwnership,
  AVATAR_MAX_BYTES,
  validateAvatarMetadata,
} from './avatar-storage.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';

assert.doesNotThrow(() => {
  assertAvatarObjectOwnership(USER_ID, `avatars/${USER_ID}/photo.jpg`);
  validateAvatarMetadata(AVATAR_MAX_BYTES, 'image/jpeg');
});
assert.throws(
  () => assertAvatarObjectOwnership(USER_ID, 'avatars/another-user/photo.jpg'),
  BadRequestException,
);
assert.throws(() => validateAvatarMetadata(AVATAR_MAX_BYTES + 1, 'image/jpeg'), BadRequestException);
assert.throws(() => validateAvatarMetadata(12_000, 'image/png'), BadRequestException);
assert.throws(() => validateAvatarMetadata(0, 'image/jpeg'), BadRequestException);

console.log('Avatar storage QA passed.');
