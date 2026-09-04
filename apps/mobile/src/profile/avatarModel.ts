export const PROFILE_AVATAR_EDGE_PX = 512;
export const PROFILE_AVATAR_MAX_BYTES = 512 * 1024;
export const PROFILE_AVATAR_JPEG_QUALITY = 0.92;

export function getHighResolutionProfileAvatarUrl(remoteUrl: string) {
  const url = new URL(remoteUrl);

  if (!url.hostname.endsWith('.googleusercontent.com')) {
    return remoteUrl;
  }

  if (/=s\d+(?:-c)?$/.test(url.pathname)) {
    url.pathname = url.pathname.replace(/=s\d+(?:-c)?$/, '=s512-c');
  } else if (url.searchParams.has('sz')) {
    url.searchParams.set('sz', String(PROFILE_AVATAR_EDGE_PX));
  } else {
    url.pathname = `${url.pathname}=s512-c`;
  }

  return url.toString();
}

export function assertProfileAvatarSize(size: number, maximum = PROFILE_AVATAR_MAX_BYTES) {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('The selected photo could not be read.');
  }

  if (size > maximum) {
    throw new Error('The selected photo is still too large after compression.');
  }
}
