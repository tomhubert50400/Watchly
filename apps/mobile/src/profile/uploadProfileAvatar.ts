import {
  confirmAvatarUpload,
  createAvatarUpload,
  type UserProfile,
} from '../api/profile';
import {
  assertProfileAvatarSize,
  getHighResolutionProfileAvatarUrl,
  PROFILE_AVATAR_EDGE_PX,
  PROFILE_AVATAR_JPEG_QUALITY,
} from './avatarModel';

export async function chooseAndUploadProfileAvatar(
  firebaseIdToken: string,
): Promise<UserProfile | null> {
  let ImagePicker: typeof import('expo-image-picker');
  try {
    ImagePicker = await import('expo-image-picker');
  } catch (error) {
    if (
      error instanceof Error
      && error.message.includes("Cannot find native module 'ExponentImagePicker'")
    ) {
      throw new Error('Update Expo Go from the App Store, then reopen Watchly.');
    }
    throw error;
  }

  const selection = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    mediaTypes: ['images'],
    quality: 0.9,
    selectionLimit: 1,
  });

  if (selection.canceled) return null;

  return uploadProfileAvatarFromUri(firebaseIdToken, selection.assets[0].uri);
}

export async function copyRemoteProfileAvatar(
  firebaseIdToken: string,
  remoteUrl: string,
): Promise<UserProfile> {
  const parsedUrl = new URL(remoteUrl);
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('The sign-in provider returned an unsupported profile photo URL.');
  }

  const FileSystem = await import('expo-file-system/legacy');
  if (!FileSystem.cacheDirectory) {
    throw new Error('Profile photo cache is unavailable in this build.');
  }

  const localUri = `${FileSystem.cacheDirectory}watchly-oauth-avatar-${Date.now()}.img`;

  try {
    const download = await FileSystem.downloadAsync(
      getHighResolutionProfileAvatarUrl(remoteUrl),
      localUri,
    );
    if (download.status < 200 || download.status >= 300) {
      throw new Error('Could not download your sign-in profile photo.');
    }

    return await uploadProfileAvatarFromUri(firebaseIdToken, download.uri);
  } finally {
    await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
  }
}

export async function uploadProfileAvatarFromUri(
  firebaseIdToken: string,
  uri: string,
): Promise<UserProfile> {

  const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
  const image = await manipulateAsync(
    uri,
    [{ resize: { height: PROFILE_AVATAR_EDGE_PX, width: PROFILE_AVATAR_EDGE_PX } }],
    { compress: PROFILE_AVATAR_JPEG_QUALITY, format: SaveFormat.JPEG },
  );
  const imageResponse = await fetch(image.uri);
  const imageBlob = await imageResponse.blob();
  const upload = await createAvatarUpload(firebaseIdToken);

  assertProfileAvatarSize(imageBlob.size, upload.maxBytes);
  const uploadResponse = await fetch(upload.uploadUrl, {
    body: imageBlob,
    headers: upload.headers,
    method: 'PUT',
  });

  if (!uploadResponse.ok) {
    throw new Error('Could not upload the profile photo. Try again.');
  }

  return confirmAvatarUpload(firebaseIdToken, upload.objectKey);
}
