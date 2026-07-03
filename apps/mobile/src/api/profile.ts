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

export type OnboardingCompletion = {
  displayName: string | null;
  id: string;
  onboardingCompleted: boolean;
};

export type PublicProfile = {
  displayName: string | null;
  id: string;
  profileVisibility: PrivacyVisibility;
  stats: {
    followersCount: number;
    postsCount: number;
    reviewsCount: number;
  };
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

type ProfileMovieReviewOpinion = {
  body: string;
  content: {
    contentType: 'movie';
    tmdbId: number;
  };
  id: string;
  score: number;
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
  score: number;
  type: 'episodeReview';
  updatedAt: string;
};

export type ProfileOpinion =
  | ProfileEpisodeRatingOpinion
  | ProfileEpisodeReviewOpinion
  | ProfileMovieRatingOpinion
  | ProfileMovieReviewOpinion;

export type ProfileOpinionsResponse = {
  items: ProfileOpinion[];
  stats: {
    followersCount: number;
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

export function completeOnboarding(firebaseIdToken: string): Promise<OnboardingCompletion> {
  return apiPut<OnboardingCompletion>(
    '/profile/me/onboarding-completed',
    {},
    { token: firebaseIdToken },
  );
}
