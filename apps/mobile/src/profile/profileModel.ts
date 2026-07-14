import type {
  ProfileOpinion,
  ProfileOpinionsResponse,
  UserProfile,
} from '../api/profile';

export type ProfileModel = {
  displayName: string;
  isPublic: boolean;
  opinions: ProfileOpinion[];
  stats: {
    followersCount: number;
    followingCount: number;
    ratingsCount: number;
    reviewsCount: number;
  };
  userId: string;
};

export function buildProfileModel(
  profile: UserProfile,
  response: ProfileOpinionsResponse,
): ProfileModel {
  const opinions = response.items.filter((opinion) => {
    if (isReview(opinion)) {
      return profile.privacy.profileVisibility === 'public';
    }

    return profile.privacy.ratingsVisibility === 'public';
  });

  return {
    displayName: profile.displayName?.trim() || 'Watchly member',
    isPublic: profile.privacy.profileVisibility === 'public',
    opinions,
    stats: {
      followersCount: response.stats.followersCount,
      followingCount: response.stats.followingCount,
      ratingsCount: opinions.length,
      reviewsCount: opinions.filter(isReview).length,
    },
    userId: profile.id,
  };
}

export function isReview(opinion: ProfileOpinion) {
  return opinion.type === 'movieReview' || opinion.type === 'episodeReview';
}
