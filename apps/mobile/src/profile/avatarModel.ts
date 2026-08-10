export const PROFILE_AVATAR_EDGE_PX = 512;
export const PROFILE_AVATAR_MAX_BYTES = 512 * 1024;

export function assertProfileAvatarSize(size: number, maximum = PROFILE_AVATAR_MAX_BYTES) {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('The selected photo could not be read.');
  }

  if (size > maximum) {
    throw new Error('The selected photo is still too large after compression.');
  }
}
