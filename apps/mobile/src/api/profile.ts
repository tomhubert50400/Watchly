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

export type PublicProfile = {
  displayName: string | null;
  id: string;
  profileVisibility: PrivacyVisibility;
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

export function getOwnPublicProfilePreview(firebaseIdToken: string): Promise<PublicProfile> {
  return apiGet<PublicProfile>('/profile/me/public-preview', { token: firebaseIdToken });
}

export function getPublicProfile(
  firebaseIdToken: string,
  userId: string,
): Promise<PublicProfile> {
  return apiGet<PublicProfile>(`/profile/users/${encodeURIComponent(userId)}`, {
    token: firebaseIdToken,
  });
}

export function getDevTestProfile(firebaseIdToken: string): Promise<PublicProfile> {
  return apiPut<PublicProfile>('/profile/dev-test-user', {}, { token: firebaseIdToken });
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
