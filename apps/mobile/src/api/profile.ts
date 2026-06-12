import { apiGet, apiPut } from './client';

export type PrivacyVisibility = 'public' | 'private';
export type SharedWatchlistVisibility = 'members' | 'private';

export type ProfilePrivacy = {
  episodeProgressVisibility: PrivacyVisibility;
  profileVisibility: PrivacyVisibility;
  ratingsVisibility: PrivacyVisibility;
  reviewsFollowProfileVisibility: true;
  sharedWatchlistVisibility: SharedWatchlistVisibility;
  viewingHistoryVisibility: PrivacyVisibility;
};

export type UserProfile = {
  displayName: string | null;
  id: string;
  privacy: ProfilePrivacy;
};

export type UpdateProfileInput = {
  displayName: string | null;
};

export type UpdatePrivacyInput = {
  episodeProgressVisibility?: PrivacyVisibility;
  profileVisibility?: PrivacyVisibility;
  ratingsVisibility?: PrivacyVisibility;
  sharedWatchlistVisibility?: SharedWatchlistVisibility;
  viewingHistoryVisibility?: PrivacyVisibility;
};

export function getProfile(firebaseIdToken: string): Promise<UserProfile> {
  return apiGet<UserProfile>('/profile/me', { token: firebaseIdToken });
}

export function updateProfile(
  firebaseIdToken: string,
  input: UpdateProfileInput,
): Promise<UserProfile> {
  return apiPut<UserProfile>('/profile/me', input, { token: firebaseIdToken });
}

export function updatePrivacy(
  firebaseIdToken: string,
  input: UpdatePrivacyInput,
): Promise<UserProfile> {
  return apiPut<UserProfile>('/profile/privacy', input, { token: firebaseIdToken });
}
