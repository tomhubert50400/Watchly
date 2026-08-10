import {
  confirmAvatarUpload,
  createAvatarUpload,
  type UserProfile,
} from '../api/profile';
import { assertProfileAvatarSize, PROFILE_AVATAR_EDGE_PX } from './avatarModel';

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

  const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
  const image = await manipulateAsync(
    selection.assets[0].uri,
    [{ resize: { height: PROFILE_AVATAR_EDGE_PX, width: PROFILE_AVATAR_EDGE_PX } }],
    { compress: 0.78, format: SaveFormat.JPEG },
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
