import { apiDelete, apiGet, apiPost, apiPut } from './client';
import type { ReleaseAlertSummary } from './notifications';
import type { SeriesProgressSummary } from './progress';
import type { MovieRating } from './ratings';
import type { TrackingState } from './tracking';
import type { ViewingStats } from './viewings';

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
  avatarUploadsEnabled: boolean;
  avatarUrl: string | null;
  displayName: string | null;
  handle: string | null;
  id: string;
  providerAvatarImportEnabled: boolean;
  profileBackdrop: ProfileBackdropSelection | null;
  privacy: ProfilePrivacy;
};

export type ProfileBackdropSelection = {
  contentType: 'movie' | 'series';
  tmdbId: number;
};

export type OnboardingCompletion = {
  displayName: string | null;
  handle: string;
  id: string;
  onboardingCompleted: boolean;
};

export type PublicProfile = {
  avatarUrl: string | null;
  blockRelationship: 'blocked_by_profile' | 'blocked_by_viewer' | null;
  canViewContent: boolean;
  displayName: string | null;
  handle: string | null;
  id: string;
  media: {
    movieRatings: MovieRating[];
    releaseAlerts: ReleaseAlertSummary[];
    seriesProgress: SeriesProgressSummary[];
    trackingStates: TrackingState[];
  };
  opinions: ProfileOpinion[];
  profileBackdrop: ProfileBackdropSelection | null;
  profileVisibility: PrivacyVisibility;
  stats: {
    followersCount: number;
    followingCount: number;
    postsCount: number;
    reviewsCount: number;
  };
  viewingStats: ViewingStats | null;
  watchlists: Array<{
    id: string;
    itemCount: number;
    name: string;
    updatedAt: string;
  }>;
};

export type CompleteOnboardingInput = {
  completedImportIds?: string[];
  displayName?: string | null;
  handle: string;
  tasteItems?: Array<{
    contentType: 'movie' | 'series';
    tmdbId: number;
  }>;
};

export type ProfileSearchItem = {
  avatarUrl: string | null;
  displayName: string;
  handle: string;
  id: string;
};

export type ProfileSearchResponse = {
  items: ProfileSearchItem[];
};

export type ProfileConnectionsResponse = {
  items: ProfileSearchItem[];
};

export type HandleAvailability = {
  available: boolean;
  handle: string;
};

type ProfileMovieRatingOpinion = {
  content: {
    contentType: 'movie';
    tmdbId: number;
  };
  id: string;
  score: number;
  type: 'movieRating';
  updatedAt: string;
};

type ProfileEpisodeRatingOpinion = {
  content: {
    contentType: 'episode';
    episodeNumber: number;
    seasonNumber: number;
    seriesTmdbId: number;
  };
  id: string;
  score: number;
  type: 'episodeRating';
  updatedAt: string;
};

type ProfileSeriesRatingOpinion = {
  content: {
    contentType: 'series';
    seriesTmdbId: number;
  };
  id: string;
  score: number;
  type: 'seriesRating';
  updatedAt: string;
};

type ProfileMovieReviewOpinion = {
  body: string;
  content: {
    contentType: 'movie';
    tmdbId: number;
  };
  id: string;
  score: number | null;
  type: 'movieReview';
  updatedAt: string;
};

type ProfileEpisodeReviewOpinion = {
  body: string;
  content: {
    contentType: 'episode';
    episodeNumber: number;
    seasonNumber: number;
    seriesTmdbId: number;
  };
  id: string;
  score: number | null;
  type: 'episodeReview';
  updatedAt: string;
};

export type ProfileOpinion =
  | ProfileEpisodeRatingOpinion
  | ProfileEpisodeReviewOpinion
  | ProfileMovieRatingOpinion
  | ProfileMovieReviewOpinion
  | ProfileSeriesRatingOpinion;

export type ProfileOpinionsResponse = {
  items: ProfileOpinion[];
  stats: {
    followersCount: number;
    followingCount: number;
    postsCount: number;
    reviewsCount: number;
  };
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

export type AvatarUploadIntent = {
  contentType: 'image/jpeg';
  headers: Record<string, string>;
  maxBytes: number;
  objectKey: string;
  uploadUrl: string;
};

export function getProfile(firebaseIdToken: string): Promise<UserProfile> {
  return apiGet<UserProfile>('/profile/me', { token: firebaseIdToken });
}

export function getOwnPublicProfilePreview(firebaseIdToken: string): Promise<PublicProfile> {
  return apiGet<PublicProfile>('/profile/me/public-preview', { token: firebaseIdToken });
}

export function getOwnProfileOpinions(firebaseIdToken: string): Promise<ProfileOpinionsResponse> {
  return apiGet<ProfileOpinionsResponse>('/profile/me/opinions', {
    token: firebaseIdToken,
  });
}

export function getPublicProfile(
  firebaseIdToken: string,
  userId: string,
): Promise<PublicProfile> {
  return apiGet<PublicProfile>(`/profile/users/${encodeURIComponent(userId)}`, {
    token: firebaseIdToken,
  });
}

export function getProfileConnections(
  firebaseIdToken: string,
  userId: string,
  kind: 'followers' | 'following',
): Promise<ProfileConnectionsResponse> {
  return apiGet<ProfileConnectionsResponse>(
    `/profile/users/${encodeURIComponent(userId)}/${kind}`,
    { token: firebaseIdToken },
  );
}

export function searchProfiles(
  firebaseIdToken: string,
  query: string,
): Promise<ProfileSearchResponse> {
  return apiGet<ProfileSearchResponse>(
    `/profile/search?query=${encodeURIComponent(query)}`,
    { token: firebaseIdToken },
  );
}

export function getHandleAvailability(
  firebaseIdToken: string,
  handle: string,
): Promise<HandleAvailability> {
  return apiGet<HandleAvailability>(
    `/profile/handle-availability?handle=${encodeURIComponent(handle)}`,
    { token: firebaseIdToken },
  );
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

export function createAvatarUpload(firebaseIdToken: string): Promise<AvatarUploadIntent> {
  return apiPost<AvatarUploadIntent>('/profile/me/avatar-upload', {}, {
    token: firebaseIdToken,
  });
}

export function confirmAvatarUpload(
  firebaseIdToken: string,
  objectKey: string,
): Promise<UserProfile> {
  return apiPut<UserProfile>('/profile/me/avatar', { objectKey }, {
    token: firebaseIdToken,
  });
}

export function removeAvatar(firebaseIdToken: string): Promise<UserProfile> {
  return apiDelete<UserProfile>('/profile/me/avatar', { token: firebaseIdToken });
}

export function updateProfileBackdrop(
  firebaseIdToken: string,
  selection: ProfileBackdropSelection | null,
): Promise<UserProfile> {
  return apiPut<UserProfile>(
    '/profile/me/backdrop',
    selection ?? { contentType: null, tmdbId: null },
    { token: firebaseIdToken },
  );
}

export function exportAccountData(firebaseIdToken: string): Promise<unknown> {
  return apiGet<unknown>('/profile/me/export', { token: firebaseIdToken });
}

export function deleteAccount(firebaseIdToken: string) {
  return apiDelete<{ deleted: true }>('/profile/me', { token: firebaseIdToken });
}

export function completeOnboarding(
  firebaseIdToken: string,
  input: CompleteOnboardingInput,
): Promise<OnboardingCompletion> {
  return apiPut<OnboardingCompletion>(
    '/profile/me/onboarding-completed',
    input,
    { token: firebaseIdToken },
  );
}
